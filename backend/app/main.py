import math
from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.auth import router as auth_router
from app.config import settings
from app.routers.app_settings import router as app_settings_router
from app.routers.checklist import router as checklist_router
from app.routers.days import router as days_router
from app.routers.items import router as items_router
from app.routers.places import router as places_router
from app.routers.settlement import router as settlement_router
from app.routers.trips import router as trips_router

app = FastAPI(title="Travel Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(trips_router)
app.include_router(days_router)
app.include_router(items_router)
app.include_router(checklist_router)
app.include_router(settlement_router)
app.include_router(app_settings_router)
app.include_router(places_router)


def _scrub_non_finite(value: Any) -> Any:
    """검증 에러 응답에 실려나가는 값 중 JSON으로 표현할 수 없는 float을 문자열로 바꾼다."""
    if isinstance(value, float) and not math.isfinite(value):
        return repr(value)  # "nan" / "inf" / "-inf"
    if isinstance(value, dict):
        return {key: _scrub_non_finite(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_scrub_non_finite(item) for item in value]
    return value


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """FastAPI 기본 422 핸들러와 동일하되, 응답에 섞인 NaN/Infinity를 문자열로 바꾼다.

    파이썬 `json.loads`는 JSON 표준에 없는 `NaN`/`Infinity` 리터럴을 기본으로 받아들이는데,
    응답을 쓰는 `json.dumps(allow_nan=False)`는 이를 거부한다. 그래서 그런 값이 담긴 요청이
    422가 되면 **에러 응답을 직렬화하다 터져서** 클라이언트는 422 대신 처리되지 않은 500을
    받는다(기본 핸들러가 `exc.errors()`의 `input`에 원본 값을 그대로 실어보내기 때문).
    브라우저의 `JSON.stringify`는 NaN을 `null`로 바꾸므로 정상 경로에서는 생기지 않지만,
    비용(`cost_amount`) 검증을 추가하면서 이 경로가 실제로 도달 가능해져 막아둔다.
    """
    return JSONResponse(
        status_code=422,
        content={"detail": _scrub_non_finite(jsonable_encoder(exc.errors()))},
    )


@app.get("/api/health")
def health():
    return {"status": "ok"}
