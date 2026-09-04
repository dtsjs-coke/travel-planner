from fastapi import APIRouter, Depends, Query

from app.deps import require_session
from app.services.google_places import get_place_details, search_places

router = APIRouter(prefix="/api/places", tags=["places"], dependencies=[Depends(require_session)])


@router.get("/search")
async def search(query: str = Query(..., min_length=1)):
    return await search_places(query)


@router.get("/{place_id}")
async def details(place_id: str):
    return await get_place_details(place_id)
