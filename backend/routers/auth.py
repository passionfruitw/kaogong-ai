"""Authentication routes."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from services.auth import authenticate, create_token, verify_token


router = APIRouter(prefix="/api/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(request: LoginRequest):
    if not authenticate(request.username, request.password):
        raise HTTPException(status_code=401, detail="账号或密码不正确")
    return {
        "token": create_token(request.username),
        "username": request.username,
    }


@router.get("/me")
async def me(request: Request):
    authorization = request.headers.get("Authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="请先登录")

    username = verify_token(token)
    if not username:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")

    return {"username": username}
