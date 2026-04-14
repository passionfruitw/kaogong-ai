"""数据模型定义"""
from pydantic import BaseModel
from typing import Optional, List, Literal


class QuestionInput(BaseModel):
    """题目输入模型"""
    question: str
    options: Optional[List[str]] = None
    user_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    module: str = "行测"  # 行测/申论/面试
    knowledge_point: Optional[str] = None


class AIAnalysisRequest(BaseModel):
    """AI分析请求"""
    question: str
    options: Optional[List[str]] = None
    user_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    module: str = "行测"
    knowledge_point: Optional[str] = None


class SocraticTeachingRequest(BaseModel):
    """苏格拉底教学请求"""
    question: str
    options: Optional[List[str]] = None
    user_answer: Optional[str] = None
    correct_answer: str
    module: str = "行测"
    knowledge_point: Optional[str] = None
    step: Literal["diagnose", "explain", "verify", "summary", "chat"] = "diagnose"
    user_response: Optional[str] = None
    conversation_history: Optional[List[dict]] = None


class VariantQuestionsRequest(BaseModel):
    """举一反三请求"""
    question: str
    options: Optional[List[str]] = None
    correct_answer: str
    module: str = "行测"
    knowledge_point: Optional[str] = None
    count: int = 3


class StudyPlanRequest(BaseModel):
    """学习方案请求"""
    wrong_knowledge_points: List[dict] = []
    session_summaries: List[dict] = []
    total_done: int = 0
    accuracy_rate: float = 0.0


class AIResponse(BaseModel):
    """AI响应"""
    content: str
    type: str  # analysis/variant/socratic
    metadata: Optional[dict] = None