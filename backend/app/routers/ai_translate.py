"""여행 도구함 — AI 번역 라우터 (유료, ADR-0014).

`ai_suggestion.py`와 prefix(`/api/ai`)는 같지만 파일을 나눈다 — 의존성(Places 게이트웨이 없음)과
비용 방어 정책(기본 꺼짐 토글 + 일일 상한)이 다르고, 도구함 쪽 기능이 늘면 여기에 붙는다.
"""

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_db
from app.deps import require_session
from app.schemas import TranslateRequest, TranslateResult
from app.services.ai_translate import translate
from app.services.gemini import GeminiClientProtocol, get_gemini_client

router = APIRouter(prefix="/api/ai", tags=["ai"], dependencies=[Depends(require_session)])


@router.post("/translate", response_model=TranslateResult)
async def translate_text(
    body: TranslateRequest,
    db: Session = Depends(get_db),
    gemini: GeminiClientProtocol = Depends(get_gemini_client),
):
    """텍스트를 번역하고 발음(한글 표기/로마자)을 함께 돌려준다.

    상태 코드: 200 / 401(미인증) / 403(설정에서 꺼짐 — 기본값) / 422(빈 텍스트·500자 초과·
    모르는 언어·source==target) / 429(일일 상한 초과) / 502(Gemini 실패) /
    503(`GEMINI_API_KEY` 미설정).

    body 검증(422)은 FastAPI가 핸들러 전에 하므로 토글 확인(403)보다 먼저 일어난다.
    어느 쪽이든 외부 호출은 나가지 않는다.
    """
    return await translate(body, db=db, gemini=gemini)
