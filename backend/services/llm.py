"""LLM service - DeepSeek API integration."""
import os
import json
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


def build_chat_completions_url(base_url: str, path: str) -> str:
    base = base_url.rstrip("/")
    suffix = path if path.startswith("/") else f"/{path}"
    return f"{base}{suffix}"

# 日志目录
LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sessions")
os.makedirs(LOG_DIR, exist_ok=True)


class LLMService:
    """LLM服务类"""

    def __init__(self, api_key: str = None, model: str = DEFAULT_MODEL):
        self.api_key = api_key or API_KEY
        self.model = model
        self.base_url = BASE_URL

    async def _call_api(self, messages: List[Dict], temperature: float = 0.7, model: str = None) -> str:
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

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                build_chat_completions_url(self.base_url, CHAT_COMPLETIONS_PATH),
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            result = response.json()
            return result["choices"][0]["message"]["content"]

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
        prompt = f"""请基于以下题目，生成{count}道同类变式题。

原题：{question_data['question']}
{''.join([f"\n选项{i+1}: {opt}" for i, opt in enumerate(question_data.get('options') or [])])}
正确答案：{question_data.get('correct_answer', '')}

要求：
1. 变式题考察同一知识点，但问法不同
2. 可以设置类似的陷阱
3. 包含题目、选项、正确答案和简要解析

请以JSON数组格式返回，每道题包含：question, options, answer, explanation"""

        messages = [{"role": "user", "content": prompt}]
        result = await self._call_api(messages, temperature=0.8)

        # 尝试解析JSON，如果失败则返回原始文本
        try:
            import json
            # 尝试提取JSON部分
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[1].split("```")[0].strip()
            variants = json.loads(result)
            return json.dumps(variants if isinstance(variants, list) else [variants])
        except:
            return json.dumps([{"question": "解析失败", "options": [], "answer": "", "explanation": result}])

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
