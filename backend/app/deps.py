from fastapi import HTTPException, Request

from app.auth import is_valid_session


def require_session(request: Request) -> None:
    if not is_valid_session(request):
        raise HTTPException(status_code=401, detail="Not authenticated")
