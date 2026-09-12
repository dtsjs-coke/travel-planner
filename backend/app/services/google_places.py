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


async def search_places(
    query: str,
    *,
    bias: tuple[float, float] | None = None,
    bias_radius_m: float = 50_000.0,
    language_code: str | None = None,
) -> list[dict]:
    """텍스트로 장소를 검색한다.

    `bias`(위도, 경도)를 주면 그 주변 결과를 우선한다 — AI 추천이 LLM이 제안한 장소명을
    "그 도시에 실제로 있는 곳"으로 확정할 때 쓴다(동명 이소를 줄인다). 기존 검색 화면은
    인자를 주지 않으므로 동작이 바뀌지 않는다.

    searchText의 `locationBias` 원(circle) 반경 상한은 50km라 그 이상은 보내지 않는다
    (더 넓은 허용 범위는 호출자가 결과 좌표로 직접 판정한다 — ADR-0009).

    `language_code`("ko")를 주면 `displayName`이 그 언어로 온다. **기본값은 None(미지정)**이라
    기존 검색 화면의 동작은 그대로다 — 지정하지 않으면 구글이 언어를 추론하는데, 실측에서
    한국 장소도 영어 이름("Penguin Village")으로 오는 경우가 있었다. AI 추천은 이 이름을
    일정 제목으로 **저장**하므로 "ko"를 명시한다(검색 결과처럼 한 번 보고 버리는 값이 아니다).
    """
    payload: dict = {"textQuery": query}
    if language_code:
        payload["languageCode"] = language_code
    if bias is not None:
        payload["locationBias"] = {
            "circle": {
                "center": {"latitude": bias[0], "longitude": bias[1]},
                "radius": min(bias_radius_m, 50_000.0),
            }
        }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{PLACES_BASE_URL}/places:searchText",
            headers=_headers(SEARCH_FIELD_MASK),
            json=payload,
            timeout=10.0,
        )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Google Places search failed: {response.text}")

    places = response.json().get("places", [])
    return [_summarize_place(place) for place in places]


async def search_nearby(
    lat: float,
    lng: float,
    *,
    included_types: list[str],
    radius_m: float = 5_000.0,
    language_code: str | None = None,
) -> list[dict]:
    """좌표 주변의 특정 유형 장소를 **인기도 순**으로 검색한다.

    AI 추천에서 LLM이 제안한 숙소가 실제로 존재하지 않을 때의 폴백 경로다 —
    그날 동선 근처(`lat`/`lng`)의 `lodging` 상위 결과를 서버가 자동으로 고른다(ADR-0009).

    `rankPreference: POPULARITY`를 쓰는 이유: `DISTANCE`로 뽑으면 "가장 가까운 숙소"가
    나오는데 그건 모텔/게스트하우스가 될 확률이 높고, 사용자가 원한 건 "이 근처의
    괜찮은 숙소"다. 반경 상한은 searchNearby도 50km다.
    `language_code`는 `search_places()`와 같은 이유로 호출자가 지정한다.
    """
    payload: dict = {
        "includedTypes": included_types,
        "rankPreference": "POPULARITY",
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": min(radius_m, 50_000.0),
            }
        },
    }
    if language_code:
        payload["languageCode"] = language_code

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{PLACES_BASE_URL}/places:searchNearby",
            headers=_headers(SEARCH_FIELD_MASK),
            json=payload,
            timeout=10.0,
        )
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Google Places nearby failed: {response.text}")

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
