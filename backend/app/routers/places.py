from fastapi import APIRouter, Depends, Query

from app.deps import require_session
from app.services.google_places import PLACES_LANGUAGE_CODE, get_place_details, search_places

router = APIRouter(prefix="/api/places", tags=["places"], dependencies=[Depends(require_session)])


@router.get("/search")
async def search(query: str = Query(..., min_length=1)):
    """장소 검색. 응답의 `category`/`region`은 일정 등록 시 그대로 저장되는 값이라
    한국어로 받는다 — 이 검색 경로에 `languageCode`를 지정하는 이유다(ADR-0011).
    ADR-0009 시점에는 검색 결과가 "한 번 보고 버리는 값"이라 지정하지 않았지만,
    이제는 여기서 온 값이 DB에 남는다."""
    return await search_places(query, language_code=PLACES_LANGUAGE_CODE)


@router.get("/{place_id}")
async def details(place_id: str):
    return await get_place_details(place_id, language_code=PLACES_LANGUAGE_CODE)
