"""AI 여행 추천 라우터.

엔드포인트 하나뿐이지만 `trips.py`에 넣지 않는다 — 여행 CRUD와 달리 **외부 LLM + Places를
호출해 여행을 여러 건 만들어내는** 별개 관심사이고, 의존성(Gemini/Places 게이트웨이)도
다르다(`checklist.py`/`settlement.py`/`export.py`를 뺀 것과 같은 기준).

이 라우터만 `async def`인 이유: LLM 호출 3건과 Places 호출 수십~수백 건을 **병렬로** 돌려야
전체 시간이 Render의 요청 타임아웃 안에 들어온다. DB 작업은 마지막에 짧게 일어난다
(자세한 트레이드오프는 ADR-0009).
"""

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_db
from app.deps import require_session
from app.schemas import TripSuggestionRequest, TripSuggestionResult
from app.services.ai_trip_suggestion import (
    PlacesGatewayProtocol,
    get_places_gateway,
    suggest_trips,
)
from app.services.gemini import GeminiClientProtocol, get_gemini_client

router = APIRouter(prefix="/api/ai", tags=["ai"], dependencies=[Depends(require_session)])


@router.post("/trip-suggestions", response_model=TripSuggestionResult, status_code=201)
async def create_trip_suggestions(
    body: TripSuggestionRequest,
    db: Session = Depends(get_db),
    gemini: GeminiClientProtocol = Depends(get_gemini_client),
    places: PlacesGatewayProtocol = Depends(get_places_gateway),
):
    """조건을 받아 최대 3개의 여행 초안을 **실제 여행(Trip)으로 생성**하고 요약을 돌려준다.

    미리보기/선택 단계가 없다(사용자 확인) — 마음에 들지 않는 안은 기존
    `DELETE /api/trips/{id}`로 지운다. 그래서 이 엔드포인트는 조회가 아니라 생성이고 201이다.

    상태 코드: 201(1개 이상 생성) / 422(조건 위반) / 401(미인증) /
    503(`GEMINI_API_KEY` 미설정) / 502(모든 안 실패).
    """
    return await suggest_trips(body, db=db, gemini=gemini, places=places)
