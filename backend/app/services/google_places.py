import httpx
from fastapi import HTTPException

from app.config import settings

PLACES_BASE_URL = "https://places.googleapis.com/v1"

# Places 응답 언어. 이 앱의 사용자는 한국인 두 명뿐이고, 여기서 오는 값(장소명/카테고리
# 라벨/지역명)은 **그대로 DB에 저장되어 화면에 다시 나온다**. 지정하지 않으면
# 구글이 언어를 추론하는데 한국 장소도 영어로 오는 경우가 있다(2026-09-13 실호출 확인).
# 그래서 AI 경로뿐 아니라 **일반 검색/상세 경로도 전부** 이 값을 쓴다(ADR-0011).
PLACES_LANGUAGE_CODE = "ko"

# 필드마스크는 **요금 티어를 결정한다**(Places API (New)는 요청한 필드 중 가장 비싼 티어로
# 과금). 아래 두 마스크의 차이가 이 앱의 비용 구조 그 자체라 함부로 필드를 더하면 안 된다:
#
#   - Pro 티어: id/displayName/formattedAddress/location/types/primaryType/
#     primaryTypeDisplayName/addressComponents  ← 검색 마스크는 **전부 이 안에 있다**
#   - Enterprise 티어: regularOpeningHours/currentOpeningHours/phone/website/rating ...
#
# 그래서 카테고리(`primaryTypeDisplayName`)와 지역명(`addressComponents`)은 검색 마스크에
# 넣어도 **추가 비용이 0**이다(같은 Pro 티어). 반대로 영업시간(`regularOpeningHours`)을
# 여기 넣으면 AI 추천 한 번이 발생시키는 최대 ~250회 검색이 전부 Enterprise 요금이 된다.
# 그래서 영업시간은 이 앱에서 **아예 다루지 않는다**(ADR-0011 "철회 기록") — 어떤 마스크에도
# 넣지 말 것.
SEARCH_FIELD_MASK = (
    "places.id,places.displayName,places.formattedAddress,places.location,places.types,"
    "places.primaryType,places.primaryTypeDisplayName,places.addressComponents"
)
# Details 마스크는 `internationalPhoneNumber`/`websiteUri` 때문에 여전히 Enterprise 티어다
# (이 두 필드는 이 기능 이전부터 있었다). 다만 이 마스크를 쓰는 경로는 `GET /api/places/{id}`
# 하나뿐이고 현재 프론트에 그 호출자가 없다 — 즉 실제로 나가는 유료 호출은 없다.
DETAILS_FIELD_MASK = (
    "id,displayName,formattedAddress,location,types,primaryType,primaryTypeDisplayName,"
    "addressComponents,internationalPhoneNumber,websiteUri"
)

# 지역명을 만들 때 쓰는 주소 구성요소. 앞 그룹에서 1개, 뒷 그룹에서 1개를 뽑아 이어 붙인다
# ("광주광역시 동구", "大阪府 大阪市"). 한국의 광역시는 `locality`가 비어 있고
# `sublocality_level_1`(구)만 오는 경우가 있어 폴백을 여러 개 둔다(실호출로 확인).
_REGION_WIDE_TYPES = ("administrative_area_level_1",)
_REGION_LOCAL_TYPES = ("locality", "sublocality_level_1", "administrative_area_level_2")


def _headers(field_mask: str) -> dict:
    if not settings.google_places_server_key:
        raise HTTPException(status_code=503, detail="GOOGLE_PLACES_SERVER_KEY is not configured")
    return {
        "X-Goog-Api-Key": settings.google_places_server_key,
        "X-Goog-FieldMask": field_mask,
        "Content-Type": "application/json",
    }


def extract_category_label(place: dict) -> str | None:
    """사람이 읽는 장소 분류 라벨("문화센터", "한식당")을 뽑는다.

    `primaryTypeDisplayName`은 구글이 이미 현지화해 주는 값이라 **우리가 타입 코드 →
    한글 라벨 매핑표를 만들지 않아도 된다**(매핑표는 타입이 수백 개고 계속 늘어서
    유지보수가 끝나지 않는다). 그게 없을 때만 원시 코드(`primaryType`)로 퇴화한다 —
    "restaurant"라도 빈칸보다는 낫고, 어차피 사용자가 고쳐 쓸 수 있는 값이다.
    """
    display = (place.get("primaryTypeDisplayName") or {}).get("text")
    return display or place.get("primaryType") or None


def extract_region_name(place: dict) -> str | None:
    """주소 구성요소에서 지역명("광주광역시 동구")을 만든다.

    `formattedAddress` 문자열을 잘라 쓰지 않는 이유: 주소 형식은 나라마다 어순이 달라서
    (한국은 큰 단위부터, 서구권은 작은 단위부터) 문자열 파싱이 나라 수만큼의 분기가 된다.
    `addressComponents`는 그 차이를 이미 **타입으로** 정규화해 준다.

    일부 장소는 구성요소가 비어 있거나 광역 단위만 온다 — 그건 오류가 아니라 정상이라
    빈 값(None)을 돌려주고, 사용자가 직접 채우게 한다(ADR-0011).
    """
    components = place.get("addressComponents") or []
    parts: list[str] = []
    for wanted_types in (_REGION_WIDE_TYPES, _REGION_LOCAL_TYPES):
        for wanted in wanted_types:
            match = next(
                (c for c in components if wanted in (c.get("types") or [])),
                None,
            )
            text = (match or {}).get("longText")
            # 같은 이름이 두 단계에 겹쳐 오는 경우("세종특별자치시 세종시")를 막는다.
            if text and text not in parts:
                parts.append(text)
                break
    return " ".join(parts) or None


def _summarize_place(place: dict) -> dict:
    location = place.get("location", {})
    return {
        "place_id": place.get("id"),
        "name": place.get("displayName", {}).get("text"),
        "formatted_address": place.get("formattedAddress"),
        "lat": location.get("latitude"),
        "lng": location.get("longitude"),
        "types": place.get("types", []),
        # 아래 둘은 검색 응답에 **추가 비용 없이** 실려 오는 값이다(위 필드마스크 주석 참고).
        # 장소를 일정으로 등록하는 시점에 그대로 저장해 두면, 나중에 상세보기를 열 때
        # 이것들 때문에 Details를 다시 부를 일이 없다(ADR-0011).
        "category": extract_category_label(place),
        "region": extract_region_name(place),
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


async def get_place_details(place_id: str, *, language_code: str | None = None) -> dict:
    """장소 하나의 상세 정보. 전화번호/웹사이트 때문에 **검색보다 비싼 Enterprise 티어
    호출**이다(위 필드마스크 주석) — 목록을 그리려고 여러 번 부르면 안 된다.
    현재 호출자는 `GET /api/places/{id}` 하나뿐이고 프론트에 그 소비자가 없다."""
    params = {"languageCode": language_code} if language_code else None
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{PLACES_BASE_URL}/places/{place_id}",
            headers=_headers(DETAILS_FIELD_MASK),
            params=params,
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
        "category": extract_category_label(place),
        "region": extract_region_name(place),
    }
