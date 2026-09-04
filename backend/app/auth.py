import datetime as dt

from fastapi import APIRouter, HTTPException, Request, Response
from jose import JWTError, jwt
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_NAME = "session"
ALGORITHM = "HS256"
SESSION_DAYS = 90


class LoginRequest(BaseModel):
    passcode: str


def create_session_token() -> str:
    expire = dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=SESSION_DAYS)
    return jwt.encode({"authorized": True, "exp": expire}, settings.secret_key, algorithm=ALGORITHM)


def is_valid_session(request: Request) -> bool:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return False
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError:
        return False
    return bool(payload.get("authorized"))


@router.post("/login")
def login(body: LoginRequest, response: Response):
    if body.passcode != settings.shared_passcode:
        raise HTTPException(status_code=401, detail="Invalid passcode")

    token = create_session_token()
    is_production = settings.environment == "production"
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=SESSION_DAYS * 24 * 60 * 60,
    )
    return {"ok": True}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}


@router.get("/me")
def me(request: Request):
    if not is_valid_session(request):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"authorized": True}
