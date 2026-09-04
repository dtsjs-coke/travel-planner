import httpx
from fastapi import HTTPException

from app.config import settings

PLACES_BASE_URL = "https://places.googleapis.com/v1"

SEARCH_FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.location,places.types"
DETAILS_FIELD_MASK = (
    "id,displayName,formattedAddress,location,internationalPhoneNumber,websiteUri,currentOpeningHours"
)


def _headers(field_mask: str) -> dict:
    if not settings.google_places_server_key:
        raise HTTPException(status_code=503, detail="GOOGLE_PLACES_SERVER_KEY is not configured")
    return {
        "X-Goog-Api-Key": settings.google_places_server_key,
        "X-Goog-FieldMask": field_mask,
        "Content-Type": "application/json",
    }


def _summarize_place(place: dict) -> dict:
    location = place.get("location", {})
    return {
        "place_id": place.get("id"),
        "name": place.get("displayName", {}).get("text"),
        "formatted_address": place.get("formattedAddress"),
        "lat": location.get("latitude"),
        "lng": location.get("longitude"),
        "types": place.get("types", []),
    }


async def search_places(query: str) -> list[dict]:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{PLACES_BASE_URL}/places:searchText",
            headers=_headers(SEARCH_FIELD_MASK),
            json={"textQuery": query},
            timeout=10.0,
        )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Google Places search failed: {response.text}")

    places = response.json().get("places", [])
    return [_summarize_place(place) for place in places]


async def get_place_details(place_id: str) -> dict:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{PLACES_BASE_URL}/places/{place_id}",
            headers=_headers(DETAILS_FIELD_MASK),
            timeout=10.0,
        )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Google Place details failed: {response.text}")

    place = response.json()
    location = place.get("location", {})
    return {
        "place_id": place.get("id"),
        "name": place.get("displayName", {}).get("text"),
        "formatted_address": place.get("formattedAddress"),
        "lat": location.get("latitude"),
        "lng": location.get("longitude"),
        "phone": place.get("internationalPhoneNumber"),
        "website": place.get("websiteUri"),
        "opening_hours": place.get("currentOpeningHours", {}).get("weekdayDescriptions"),
    }
