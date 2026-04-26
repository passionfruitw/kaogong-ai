"""考公AI备考助手 - 后端服务"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import ai, auth

# 加载环境变量
load_dotenv()

app = FastAPI(
    title="考公AI备考助手",
    description="具备AI苏格拉底式教学法的智能考公备考平台",
    version="1.0.0"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(ai.router)
app.include_router(auth.router)


@app.get("/")
async def root():
    return {
        "message": "欢迎使用考公AI备考助手",
        "version": "1.0.0",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host=host, port=port)
