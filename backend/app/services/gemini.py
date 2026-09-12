"""Gemini(Google Generative Language API) 호출부 — **이 파일이 유일한 외부 LLM 접점이다.**

공식 SDK(`google-genai`)를 쓰지 않고 REST를 `httpx`로 직접 부른다. 근거는 ADR-0009:
우리가 쓰는 건 `generateContent` 한 개 엔드포인트 + 구조화 출력 설정 두 줄이고,
`google_places.py`가 이미 같은 방식(httpx + REST + 필드마스크)으로 검증돼 있다.

API 키가 없어도 **임포트/앱 기동은 성공**한다. 키 검사는 실제 호출 시점에만 하며,
그때 503을 준다(`google_places._headers()`와 같은 정책). 그래서 키 발급 전에도
나머지 모든 코드와 테스트가 정상 동작한다.

테스트는 이 클래스를 그대로 대체한다 — 라우터가 `Depends(get_gemini_client)`로 받으므로
`app.dependency_overrides[get_gemini_client]`에 목을 꽂으면 네트워크가 사라진다.
"""

from __future__ import annotations

import json
from typing import Any, Protocol

import httpx
from fastapi import HTTPException

from app.config import settings

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

# 한 번의 LLM 호출에 허용하는 최대 시간. Render 무료 티어의 요청 타임아웃(100초 근처) 안에서
# "호출 + 재시도 1회"가 끝나야 하므로 여기서부터 예산을 쪼갠다(ADR-0009의 시간 예산 표 참고).
DEFAULT_TIMEOUT_SECONDS = 30.0


class GeminiError(RuntimeError):
    """Gemini 호출/응답 파싱 실패. `retryable`이 True면 한 번 더 시도할 가치가 있다."""

    def __init__(self, message: str, *, retryable: bool) -> None:
        super().__init__(message)
        self.retryable = retryable


class GeminiClientProtocol(Protocol):
    """서비스 레이어가 의존하는 최소 인터페이스 (테스트 목이 만족해야 하는 계약)."""

    async def generate_json(
        self,
        *,
        system_instruction: str,
        prompt: str,
        response_schema: dict[str, Any],
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> dict[str, Any]: ...


class GeminiClient:
    """구조화 출력(JSON) 전용 Gemini 클라이언트."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str | None = None,
        thinking_budget: int | None = None,
    ) -> None:
        self._api_key = settings.gemini_api_key if api_key is None else api_key
        self._model = settings.gemini_model if model is None else model
        self._thinking_budget = (
            settings.gemini_thinking_budget if thinking_budget is None else thinking_budget
        )

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    async def generate_json(
        self,
        *,
        system_instruction: str,
        prompt: str,
        response_schema: dict[str, Any],
        timeout: float = DEFAULT_TIMEOUT_SECONDS,
    ) -> dict[str, Any]:
        """프롬프트를 보내고 **스키마에 맞는 JSON 객체**를 받아 dict로 돌려준다.

        `responseMimeType: application/json` + `responseSchema`를 함께 지정하면 모델이
        자유 텍스트나 ```json 코드펜스를 섞지 않고 JSON만 낸다(= 정규식으로 JSON을
        긁어내는 취약한 파싱 코드를 만들 필요가 없다). 스키마를 지켰는지는 호출자가
        pydantic으로 한 번 더 검증한다 — 모델 쪽 보장을 신뢰하지 않는다.
        """
        if not self._api_key:
            # 키가 없는 것은 서버 설정 미비이므로 5xx다(클라이언트가 고칠 수 있는 게 없다).
            raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not configured")

        generation_config: dict[str, Any] = {
            "responseMimeType": "application/json",
            "responseSchema": response_schema,
            # 3개 안이 서로 달라야 의미가 있는 기능이라 온도를 낮추지 않는다.
            "temperature": 1.0,
        }
        if self._thinking_budget >= 0:
            generation_config["thinkingConfig"] = {"thinkingBudget": self._thinking_budget}

        body = {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": generation_config,
        }

        url = f"{GEMINI_BASE_URL}/models/{self._model}:generateContent"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    headers={
                        # 키를 쿼리스트링(`?key=`)이 아니라 헤더로 보낸다 — URL은 프록시/로그에
                        # 그대로 남는다.
                        "x-goog-api-key": self._api_key,
                        "Content-Type": "application/json",
                    },
                    json=body,
                    timeout=timeout,
                )
        except httpx.HTTPError as exc:  # 타임아웃/연결 실패
            raise GeminiError(f"Gemini request failed: {exc}", retryable=True) from exc

        if response.status_code != 200:
            # 429(레이트리밋)/5xx는 재시도 가치가 있고, 400(스키마·프롬프트 문제)/403(키)은 없다.
            retryable = response.status_code == 429 or response.status_code >= 500
            raise GeminiError(
                f"Gemini returned {response.status_code}: {response.text[:500]}",
                retryable=retryable,
            )

        return _extract_json_object(response.json())


def _extract_json_object(payload: dict[str, Any]) -> dict[str, Any]:
    """`generateContent` 응답 봉투에서 JSON 본문을 꺼낸다.

    본문이 비는 경우가 실제로 있다 — 안전필터 차단(`finishReason: SAFETY`)이나
    출력 토큰 상한(`MAX_TOKENS`)에 걸리면 `parts`가 없거나 JSON이 중간에서 끊긴다.
    둘 다 "재시도하면 달라질 수 있는" 실패라 retryable로 둔다.
    """
    candidates = payload.get("candidates") or []
    if not candidates:
        feedback = payload.get("promptFeedback")
        raise GeminiError(f"Gemini returned no candidates (promptFeedback={feedback})", retryable=True)

    candidate = candidates[0]
    parts = (candidate.get("content") or {}).get("parts") or []
    text = "".join(part.get("text", "") for part in parts).strip()
    if not text:
        raise GeminiError(
            f"Gemini returned empty content (finishReason={candidate.get('finishReason')})",
            retryable=True,
        )

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise GeminiError(f"Gemini returned non-JSON content: {exc}", retryable=True) from exc

    if not isinstance(parsed, dict):
        raise GeminiError("Gemini returned a JSON value that is not an object", retryable=True)
    return parsed


def get_gemini_client() -> GeminiClientProtocol:
    """FastAPI 의존성. 테스트는 이 함수를 `dependency_overrides`로 갈아끼운다."""
    return GeminiClient()
