"""LLM service - DeepSeek API integration."""
import os
import json
import re
import asyncio
import httpx
from datetime import datetime
from typing import List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()

def _env(name: str) -> str:
    return os.getenv(name, "").strip()


def get_default_model() -> str:
    return _env("DEEPSEEK_MODEL") or "deepseek-v4-flash"


# API配置
API_KEY = _env("DEEPSEEK_API_KEY")
BASE_URL = _env("DEEPSEEK_BASE_URL") or "https://api.deepseek.com"
DEFAULT_MODEL = get_default_model()
CHAT_COMPLETIONS_PATH = _env("DEEPSEEK_CHAT_COMPLETIONS_PATH") or "/chat/completions"
OPTION_LABELS = ["A", "B", "C", "D"]
RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


def build_chat_completions_url(base_url: str, path: str) -> str:
    base = base_url.rstrip("/")
    suffix = path if path.startswith("/") else f"/{path}"
    return f"{base}{suffix}"


def _strip_code_fence(content: str) -> str:
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", content, re.IGNORECASE)
    return (match.group(1) if match else content).strip()


def _parse_json_like(content: str):
    clean = _strip_code_fence(content)
    candidates = [clean]

    array_start = clean.find("[")
    array_end = clean.rfind("]")
    if array_start != -1 and array_end > array_start:
        candidates.append(clean[array_start:array_end + 1])

    object_start = clean.find("{")
    object_end = clean.rfind("}")
    if object_start != -1 and object_end > object_start:
        candidates.append(clean[object_start:object_end + 1])

    last_error = None
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except Exception as exc:
            last_error = exc

    raise ValueError(f"invalid JSON from LLM: {last_error}")


def _dig_first(value):
    if isinstance(value, list):
        return value[0] if value else {}
    if isinstance(value, dict):
        for key in ("variants", "questions", "items", "data", "result", "变式题", "题目列表"):
            if key in value:
                return _dig_first(value[key])
    return value


def _pick(data: dict, keys: List[str]):
    for key in keys:
        value = data.get(key)
        if value is not None:
            return value
    return None


def _strip_option_label(option: str) -> str:
    return re.sub(r"^\s*[A-Da-d][、.．:：\s]+", "", option).strip()


def _normalize_options(value) -> List[str]:
    if isinstance(value, list):
        return [_strip_option_label(str(item)) for item in value if str(item).strip()]

    if isinstance(value, dict):
        options = []
        for label in OPTION_LABELS:
            item = value.get(label) or value.get(label.lower()) or value.get(f"选项{label}")
            if item is not None and str(item).strip():
                options.append(_strip_option_label(str(item)))
        return options

    if isinstance(value, str):
        parts = re.split(r"(?=\s*[A-Da-d][、.．:：]\s*)", value)
        options = [_strip_option_label(part) for part in parts if _strip_option_label(part)]
        if len(options) >= 4:
            return options
        return [_strip_option_label(part) for part in re.split(r"\n|[；;]", value) if _strip_option_label(part)]

    return []


def _normalize_answer(value) -> str:
    match = re.search(r"[A-Da-d]", str(value or ""))
    return match.group(0).upper() if match else ""


def _normalize_variant(value) -> Optional[dict]:
    data = _dig_first(value)
    if not isinstance(data, dict):
        return None

    question = str(_pick(data, ["question", "题目", "stem", "题干", "content"]) or "").strip()
    options = _normalize_options(_pick(data, ["options", "选项", "choices", "选项列表"]))
    answer = _normalize_answer(_pick(data, ["answer", "答案", "correct_answer", "correctAnswer", "正确答案"]))
    explanation = str(_pick(data, ["explanation", "解析", "analysis", "solution", "解题思路"]) or "").strip()

    if not question or len(options) < 4 or answer not in OPTION_LABELS:
        return None

    return {
        "question": question,
        "options": options[:4],
        "answer": answer,
        "explanation": explanation
    }

# 日志目录
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sessions")
os.makedirs(LOG_DIR, exist_ok=True)


class LLMService:
    """LLM服务类"""

    def __init__(self, api_key: str = None, model: str = DEFAULT_MODEL):
        self.api_key = api_key or API_KEY
        self.model = model
        self.base_url = BASE_URL

    async def _call_api(
        self,
        messages: List[Dict],
        temperature: float = 0.7,
        model: str = None,
        retries: int = 0,
        timeout: float = 120.0
    ) -> str:
        """调用LLM API（OpenAI兼容格式）"""
        if not self.api_key:
            raise ValueError("DEEPSEEK_API_KEY is not configured")

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": model or self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 8192
        }

        last_error = None
        attempts = max(1, retries + 1)

        for attempt in range(attempts):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(
                        build_chat_completions_url(self.base_url, CHAT_COMPLETIONS_PATH),
                        headers=headers,
                        json=payload
                    )
                    response.raise_for_status()
                    result = response.json()
                    return result["choices"][0]["message"]["content"]
            except httpx.HTTPStatusError as exc:
                last_error = exc
                status_code = exc.response.status_code
                if status_code not in RETRYABLE_STATUS_CODES or attempt >= attempts - 1:
                    raise
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                last_error = exc
                if attempt >= attempts - 1:
                    raise

            await asyncio.sleep(min(1.5 * (attempt + 1), 4.0))

        raise RuntimeError(f"LLM request failed after retries: {last_error}")

    async def analyze_question(self, question_data: dict) -> str:
        """AI错题解析"""
        prompt = f"""你是一位专业的考公备考导师。请分析以下错题：

题目：{question_data['question']}
{''.join([f"\n选项{i+1}: {opt}" for i, opt in enumerate(question_data.get('options') or [])])}
用户答案：{question_data.get('user_answer', '未填写')}
正确答案：{question_data.get('correct_answer', '未填写')}

请提供详细的解析，包括：
1. 题目涉及的知识点
2. 错误原因分析
3. 解题思路和步骤
4. 相关知识点的简要说明

请用通俗易懂的语言解释，控制在200字左右。"""

        messages = [{"role": "user", "content": prompt}]
        return await self._call_api(messages)

    async def generate_variants(self, question_data: dict, count: int = 3) -> List[dict]:
        """举一反三 - 生成变式题"""
        safe_count = max(1, min(int(count or 1), 5))
        options_text = ''.join([
            f"\n{OPTION_LABELS[i]}. {opt}"
            for i, opt in enumerate(question_data.get('options') or [])
            if i < len(OPTION_LABELS)
        ])
        passage_text = question_data.get("passage")
        passage_context = f"\n原题材料：{passage_text}" if passage_text else ""

        prompt = f"""你是公务员考试命题专家。请基于以下真题生成{safe_count}道“迁移训练”题。

知识点：{question_data.get('knowledge_point') or '未标注'}
模块：{question_data.get('module') or '行测'}
{passage_context}
原题：{question_data['question']}
{options_text}
正确答案：{question_data.get('correct_answer', '')}

硬性要求：
1. 先抽象原题考查的底层能力，只保留这个能力；其余材料、主体、行业、情境、数字、问法都必须重写。
2. 新题不得出现原题中的专有主体、行业场景、关键数字、关键名词和原选项表达。不要复用原题任何一个选项。
3. 新题不能只把原题改成“正确/不正确”“属于/不属于”的反向问法，也不能只追问原题计算过程中的中间量。
4. 对定义判断：必须新造一个定义和四个全新案例，案例所属领域要与原题不同；保留“抓定义要件辨析”的能力即可。
5. 对数量关系：必须换成不同生活/工作场景，至少改变两个条件关系；不要沿用原题百分数、金额、主体、求解对象和方程结构。
   - 如果原题是“某项优惠/补贴占总额比例 + 原本亏损占总额比例 + 享受后盈利 + 求总额”，新题禁止继续使用“优惠/补贴/返还占总额比例、亏损率、由亏转盈、求总额”这一整套关系模板。
   - 可以迁移到利润率、成本构成、销量变化、售价折扣、固定成本摊销、工程效率、浓度混合等其他数量关系外壳，但解题入口必须明显不同。
6. 对资料分析：必须换资料背景和指标口径，不能沿用原材料数值或年份；保留同类统计计算能力即可。
7. 选项必须互斥且只有一个正确答案，答案只能是 A/B/C/D。
8. 解析必须先说明“原题考点迁移到哪里”，再给出新题的独立解题路径。

生成前请在心里检查：如果学生看出这是原题换皮，就不合格；必须重写。

请严格只返回 JSON 数组，不要 Markdown，不要解释性文字。数组中每项必须且只能包含这些字段：
[
  {{
    "question": "题干",
    "options": ["选项A", "选项B", "选项C", "选项D"],
    "answer": "A",
    "explanation": "解析"
  }}
]"""

        messages = [{"role": "user", "content": prompt}]
        result = await self._call_api(messages, temperature=0.95, retries=2, timeout=150.0)

        # 尝试解析并规范化JSON，避免前端收到不稳定格式。
        try:
            parsed = _parse_json_like(result)
            raw_variants = parsed if isinstance(parsed, list) else [parsed]
            variants = []
            for item in raw_variants:
                variant = _normalize_variant(item)
                if variant:
                    variants.append(variant)
            if variants:
                return json.dumps(variants, ensure_ascii=False)
            raise ValueError("missing required variant fields")
        except Exception as exc:
            raise ValueError(f"AI返回的变式题格式不完整，请重试。原始错误：{exc}")

    async def socratic_teaching(self, question_data: dict, step: str, user_response: str = None) -> dict:
        """苏格拉底式教学"""
        knowledge_point = question_data.get('knowledge_point', '本题知识点')

        # 获取对话历史
        conversation_history = question_data.get('history', '')

        if step == "diagnose":
            prompt = f"""你是一位苏格拉底式教学导师。你正在帮助学生理解一道题，但你绝对不能透露正确答案。

题目：{question_data['question']}
{''.join([f"\n{chr(65+i)}. {opt}" for i, opt in enumerate(question_data.get('options') or [])])}
知识点：{knowledge_point}

请用一句话询问学生的整体解题思路。不要给任何提示，不要提及答案，不要说"正确"或"错误"。

示例风格：「这道题考查的是{knowledge_point}，你能先说说整体解题思路吗？」

只输出这一句提问，不要其他内容。"""

        elif step == "chat":
            history_text = f"\n对话历史：\n{conversation_history}" if conversation_history else ""

            prompt = f"""你是一位苏格拉底式教学导师。你的任务是通过提问引导学生自己发现正确思路，而不是直接告诉他答案。

题目：{question_data['question']}
{''.join([f"\n{chr(65+i)}. {opt}" for i, opt in enumerate(question_data.get('options') or [])])}
正确答案（仅供你判断学生对错，绝对不能直接告诉学生）：{question_data.get('correct_answer', '')}
知识点：{knowledge_point}{history_text}

学生最新回答：{user_response}

你必须遵守以下规则：
1. 刚开始绝对不能说出正确答案是哪个选项
2. 如果学生思路有误，先承接其中合理的部分，再温和纠偏；只有方向完全错误时才说"这个思路有问题"，避免生硬否定
3. 如果学生已经得出正确答案或正确思路，立即给予肯定并结束对话，不要继续追问细节或延伸问题
4. 教学重点是帮助学生理解完整解题路线：已知条件如何转化、关键关系如何建立、最后如何计算或判断
5. 对学生已经掌握的基础知识点不要反复追问，例如直角三角形三边关系、简单比例、单位换算等；除非这些点明显影响主线
6. 遇到基础步骤时，可以直接简短承接，再把问题推进到下一步，例如"这个判断可以，下一步要用它求什么？"
7. 对排列组合、概率、行程等题，若后续情况只是对称或同型重复计算，可以直接点明"另一种同理/对称"，不要让学生机械重复同一类计算
8. 学生给出局部数量或中间式时，先判断它对应哪一种情况，再提示是否需要乘以分布数、对称情况或补最后的概率/比例闭环
9. 整个对话尽量控制在5轮以内，不要反复纠缠同一个细节
10. 每次回复只围绕一个推进点，控制在100字以内
11. 用自然对话语气，不要列条目

请直接给出你的回复。"""

        elif step == "summary":
            # 总结模式 - 需要保存日志
            prompt = f"""请总结本次关于「{knowledge_point}」的学习：

题目：{question_data['question']}
正确答案：{question_data.get('correct_answer', '')}

对话历史：
{conversation_history}

请输出JSON格式的总结：
{{
  "knowledge_summary": "一句话知识点总结",
  "mastery_level": "掌握程度（已掌握/部分掌握/需加强）",
  "key_insights": ["用户理解的关键点"],
  "areas_for_improvement": ["需要加强的地方"],
  "next_review": "下次复习建议"
}}

只输出JSON，不要其他内容。"""

        messages = [{"role": "user", "content": prompt}]
        content = await self._call_api(messages)

        # 如果是summary步骤，保存日志
        if step == "summary":
            # 解析对话历史
            messages_list = []
            if conversation_history:
                for line in conversation_history.split('\n'):
                    if line.startswith('user: '):
                        messages_list.append({"role": "user", "content": line[6:]})
                    elif line.startswith('ai: '):
                        messages_list.append({"role": "ai", "content": line[4:]})

            session_id = save_session_log(question_data, messages_list, content)
            if session_id:
                content += f"\n\n📝 学习记录已保存 (ID: {session_id})"

        return {
            "content": content,
            "step": step,
            "knowledge_point": knowledge_point
        }


    async def chat(self, prompt: str, model: str = None) -> str:
        """通用聊天接口"""
        messages = [{"role": "user", "content": prompt}]
        return await self._call_api(messages, temperature=0.7, model=model)

    async def generate_study_plan(self, data: dict) -> str:
        """AI生成个性化学习方案"""
        wrong_points = data.get('wrong_knowledge_points', [])
        session_summaries = data.get('session_summaries', [])
        total_done = data.get('total_done', 0)
        accuracy_rate = data.get('accuracy_rate', 0.0)

        wrong_text = '、'.join([f"{p['knowledge_point']}（错{p['count']}次）" for p in wrong_points]) or '暂无数据'
        session_text = '、'.join([f"{s['knowledge_point']}（{s['mastery_level']}）" for s in session_summaries]) or '暂无数据'

        prompt = f"""你是一位专业的考公备考规划师。根据以下学习数据，为用户生成一份个性化的7天备考学习方案：

错题薄弱点：{wrong_text}
苏格拉底教学掌握情况：{session_text}
总做题数：{total_done}，正确率：{accuracy_rate:.0%}

请输出：
1. 当前备考状态评估（2-3句话）
2. 重点攻克知识点（按优先级排序）
3. 7天学习计划（每天具体任务）
4. 针对薄弱点的专项建议

用简洁、鼓励的语气，控制在400字以内。"""

        messages = [{"role": "user", "content": prompt}]
        return await self._call_api(messages, temperature=0.7)


# 全局服务实例
llm_service = LLMService()


def save_session_log(question_data: dict, messages: list, summary: str):
    """保存学习会话日志到文件"""
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_id = f"session_{timestamp}"

        log_data = {
            "session_id": session_id,
            "timestamp": datetime.now().isoformat(),
            "question": question_data.get('question', ''),
            "module": question_data.get('module', ''),
            "knowledge_point": question_data.get('knowledge_point', ''),
            "correct_answer": question_data.get('correct_answer', ''),
            "conversation": messages,
            "summary": summary
        }

        log_file = os.path.join(LOG_DIR, f"{session_id}.json")
        with open(log_file, 'w', encoding='utf-8') as f:
            json.dump(log_data, f, ensure_ascii=False, indent=2)

        return session_id
    except Exception as e:
        print(f"保存日志失败: {e}")
        return None


def get_sessions_summary() -> dict:
    """读取所有会话日志并汇总"""
    sessions = []
    mastery_distribution = {"已掌握": 0, "部分掌握": 0, "需加强": 0}

    try:
        for filename in os.listdir(LOG_DIR):
            if not filename.endswith('.json'):
                continue
            filepath = os.path.join(LOG_DIR, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # 解析 mastery_level
            summary = data.get('summary', '')
            mastery_level = ''
            if isinstance(summary, dict):
                mastery_level = summary.get('mastery_level', '')
            elif isinstance(summary, str):
                try:
                    # summary 可能是带 JSON 的字符串
                    clean = summary
                    if '```json' in clean:
                        clean = clean.split('```json')[1].split('```')[0].strip()
                    parsed = json.loads(clean)
                    mastery_level = parsed.get('mastery_level', '')
                except Exception:
                    pass

            if mastery_level in mastery_distribution:
                mastery_distribution[mastery_level] += 1

            sessions.append({
                "session_id": data.get('session_id', ''),
                "timestamp": data.get('timestamp', ''),
                "knowledge_point": data.get('knowledge_point', ''),
                "module": data.get('module', ''),
                "mastery_level": mastery_level
            })
    except Exception as e:
        print(f"读取会话日志失败: {e}")

    sessions.sort(key=lambda x: x['timestamp'], reverse=True)
    return {
        "total_sessions": len(sessions),
        "mastery_distribution": mastery_distribution,
        "sessions": sessions
    }
