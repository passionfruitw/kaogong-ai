"""AI功能路由"""
from fastapi import APIRouter, Depends, HTTPException
from deps import require_auth
from models.schemas import (
    AIAnalysisRequest,
    AIResponse,
    SocraticTeachingRequest,
    VariantQuestionsRequest,
    StudyPlanRequest
)
from services.llm import llm_service, get_sessions_summary

router = APIRouter(prefix="/api/ai", tags=["AI功能"])


@router.post("/analyze", response_model=AIResponse)
async def analyze_question(request: AIAnalysisRequest, _username: str = Depends(require_auth)):
    """AI错题解析"""
    try:
        question_data = request.model_dump()
        content = await llm_service.analyze_question(question_data)
        return AIResponse(
            content=content,
            type="analysis",
            metadata={"module": request.module}
        )
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/variants", response_model=AIResponse)
async def generate_variant_questions(request: VariantQuestionsRequest, _username: str = Depends(require_auth)):
    """举一反三 - 生成变式题"""
    try:
        question_data = request.model_dump()
        variants = await llm_service.generate_variants(question_data, request.count)
        return AIResponse(
            content=variants,
            type="variant",
            metadata={"count": request.count, "module": request.module}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/socratic/teach", response_model=AIResponse)
async def socratic_teaching(request: SocraticTeachingRequest, _username: str = Depends(require_auth)):
    """苏格拉底式AI教学"""
    try:
        question_data = request.model_dump()

        # 如果有对话历史，添加到上下文中
        if request.conversation_history:
            history_context = "\n".join([
                f"{msg['role']}: {msg['content']}"
                for msg in request.conversation_history
            ])
            question_data['history'] = history_context

        result = await llm_service.socratic_teaching(
            question_data,
            request.step,
            request.user_response
        )
        return AIResponse(
            content=result["content"],
            type="socratic",
            metadata={"step": result["step"], "knowledge_point": result["knowledge_point"]}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "考公AI备考助手"}


@router.post("/chat", response_model=AIResponse)
async def chat(request: dict, _username: str = Depends(require_auth)):
    """通用聊天接口"""
    try:
        prompt = request.get("prompt", "")
        model = request.get("model", "deepseek-v4-flash")

        content = await llm_service.chat(prompt, model)
        return AIResponse(
            content=content,
            type="chat",
            metadata={"model": model}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/summary")
async def sessions_summary(_username: str = Depends(require_auth)):
    """获取苏格拉底教学会话汇总"""
    try:
        return get_sessions_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/study-plan", response_model=AIResponse)
async def generate_study_plan(request: StudyPlanRequest, _username: str = Depends(require_auth)):
    """AI生成个性化学习方案"""
    try:
        content = await llm_service.generate_study_plan(request.model_dump())
        return AIResponse(content=content, type="study-plan")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
