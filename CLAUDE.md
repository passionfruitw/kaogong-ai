# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (React + TypeScript + Vite)
```bash
cd frontend
npm install        # Install dependencies
npm run dev        # Start dev server on port 3000
npm run build      # Build (runs tsc then vite build)
npm run preview    # Preview production build
```

### Backend (Python FastAPI)
```bash
cd backend
pip install -r requirements.txt   # Install dependencies
python main.py                    # Start server on port 8000 (default)
```

### Environment Setup
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with SILICONFLOW_API_KEY
```

### Question Import Script
Use `import_questions.py` to batch import questions from PDF:

```bash
python import_questions.py
```

**Configuration (edit script header):**
- `PDF_PATH`: Path to exam PDF
- `ANSWER_PDF_PATH`: Path to answer PDF
- `MODULE_RANGES`: Question type distribution (e.g., 常识判断: 1-20)
- `START_ID`: Starting question ID (e.g., 201)

**Features:**
- Extracts questions, options, answers from PDF (preserves original text)
- Auto-extracts images to `frontend/public/images/`
- Generates TypeScript files in `frontend/src/data/questions/[exam-set]/`
- Updates `questions/index.ts` automatically
- Saves raw text to `questions_raw.txt` and `answers_raw.txt` for verification

## Architecture

This is a full-stack Chinese civil service exam (考公) prep app with AI Socratic tutoring.

### Frontend (`frontend/src/`)
Single-page React app with view-based routing managed in `App.tsx` state (`View` type). No React Router — views are conditionally rendered. State for wrong questions, done questions, and custom questions is persisted to `localStorage`.

**Views and their components:**
- `bank` → `QuestionBank.tsx` — browse/filter question library
- `practice` → `Practice.tsx` — answer questions (supports regular questions, training variants, and wrong-question review)
- `wrong` → `WrongQuestions.tsx` — wrong question collection
- `ai-help` → `SocraticTeaching.tsx` / `StrengtheningTraining.tsx` — AI tutoring sub-views
- `stats` → `Statistics.tsx` — progress statistics

**Data flow:** `App.tsx` owns all global state and passes callbacks down. Questions come from `data/questions.ts` (static) plus `customQuestions` (localStorage). API calls go through `api.ts` (axios, proxied to backend at `/api`).

### Backend (`backend/`)
FastAPI app with a single router. No database — sessions are stored as JSON files in `backend/sessions/`.

- `main.py` — app entry, CORS config, router registration
- `routers/ai.py` — all API endpoints under `/api/ai/`
- `services/llm.py` — LLM service wrapping 硅基流动 (SiliconFlow) API (OpenAI-compatible), session log persistence
- `models/schemas.py` — Pydantic request/response models

### API Endpoints (`/api/ai/`)
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/analyze` | AI error analysis for a question |
| POST | `/variants` | Generate variant questions (举一反三) |
| POST | `/socratic/teach` | Socratic teaching (steps: `diagnose`, `chat`, `summary`) |
| POST | `/chat` | General chat (used for generating training questions) |
| POST | `/study-plan` | Generate personalized 7-day study plan |
| GET | `/sessions/summary` | Aggregate all saved session logs |
| GET | `/health` | Health check |

### LLM Integration
Uses 硅基流动 (SiliconFlow) API with OpenAI-compatible format. Default model: `deepseek-ai/DeepSeek-V3`. Config via env vars: `SILICONFLOW_API_KEY`, `SILICONFLOW_BASE_URL`, `SILICONFLOW_MODEL`.

### Vite Proxy
The frontend proxies `/api/*` to `http://localhost:8000` in dev (configured in `vite.config.ts`). The `allowedHosts` includes `bore.pub` for tunnel-based remote access.

## Question Bank Structure

### Organization
- Questions are organized by exam sets in `frontend/src/data/questions/`
- Each exam set has its own folder: `2020国考地市/`, `2021国考地市/`, etc.
- Each question is a separate file: `question_201.ts`, `question_202.ts`, etc.
- Passages (material-based questions) are in `frontend/src/data/passages/index.ts`

### Question File Format
Each question file exports a single `Question` object:
```typescript
const question201: Question = {
  id: 201,
  module: '言语理解' | '数量关系' | '判断推理' | '资料分析' | '常识判断',
  knowledgePoint: 'string',
  question: 'string',
  options: ['A、...', 'B、...', 'C、...', 'D、...'],
  answer: 'A',
  examSet: '2020国考地市',
  passageId?: number  // optional, for material-based questions
}
export default question201
```

### Question Import
`frontend/src/data/questions.ts` imports all questions and exports them as an array:
```typescript
import question201 from './questions/2020国考地市/question_201'
// ... more imports
export const questions: Question[] = [question201, question202, ...]
```

### PDF Extraction Process
When adding new exam sets from PDF:
1. Use PyMuPDF (fitz) to extract text from PDF
2. Handle UTF-8 encoding: `sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')`
3. Extract questions preserving original text exactly ("一字不差")
4. Create individual `.ts` files in exam set folder
5. Update imports in `questions.ts`

### UI Components
- `QuestionBank.tsx` — displays questions by exam set
- `Practice.tsx` — practice mode (no module filters during exam practice)
- `QuestionCard.tsx` — renders question with options (regex handles both "A." and "A、" formats)
- `App.tsx` — added `exam-sets` view for browsing exam sets

### Known Issues Fixed
- Option display: Updated regex `/^[A-D][、.\s]+/` to handle Chinese punctuation
- Module filters: Removed from Practice component to prevent switching questions during exam
- Passages: Separated into `passages/index.ts` to avoid duplication

### 2020国考地市文件地址
- 真题："C:\Users\wuyih\Downloads\34省+国考真题\34省省考+国考PDF版推荐使用\国考2000-2024真题pdf 【推荐用这个版本】\2000-2024国考行测PDF\行测-真题\2020年国家公务员考试《行测》真题（地市级）.pdf"
- 答案："C:\Users\wuyih\Downloads\34省+国考真题\34省省考+国考PDF版推荐使用\国考2000-2024真题pdf 【推荐用这个版本】\2000-2024国考行测PDF\行测-答案及解析\2020年国家公务员考试《行测》真题（地市级）答案及解析...pdf"

## 资料分析题导入踩坑记录

### 使用 MinerU API 导入资料分析题

**脚本**: `import_mineru.py`

**配置项**:
```python
ID_PREFIX = 20201002  # 题目ID前缀
START_QUESTION = 116  # 起始题号
END_QUESTION = 120    # 结束题号
PASSAGE_ID = 20201002116  # 材料ID
PASSAGE_TITLE = "2013~2018年中国集成电路进出口状况"  # 材料标题
```

### 常见问题及解决方案

#### 1. LaTeX 符号显示错误
**问题**: 选项中包含 `$5\sim 10$` 等 LaTeX 符号，前端显示异常

**解决**: 在 `parse_questions()` 中清理 LaTeX 符号
```python
opt_text = re.sub(r'\$([^$]+)\$', r'\1', opt_text)
opt_text = opt_text.replace(r'\sim', '~')
```

#### 2. 选项末尾出现材料标记
**问题**: 选项末尾出现 "（一）"、"（二）" 等下一题材料标记

**解决**: 清理选项末尾的材料标记
```python
opt_text = re.sub(r'\s*[（(][一二三四五][）)]\s*$', '', opt_text)
```

#### 3. HTML 表格不显示
**问题**: 材料中的表格无法正常渲染

**解决**:
- 使用 `dangerouslySetInnerHTML` 渲染 HTML 内容
- 添加 CSS 样式设置表格边框和内边距

```typescript
<div dangerouslySetInnerHTML={{ __html: passage.content }} />
```

```css
.passage-text table {
  border-collapse: collapse;
  margin: 15px 0;
}
.passage-text table td {
  border: 1px solid #ddd;
  padding: 8px 12px;
}
```

#### 4. 索引文件被覆盖
**问题**: 每次导入新题目，`questions/index.ts` 和 `passages/index.ts` 被覆盖，之前的题目丢失

**解决**: 修改 `update_index()` 函数，读取现有索引并合并
```python
def update_index(question_ids):
    existing_ids = set()
    if os.path.exists(QUESTIONS_INDEX):
        with open(QUESTIONS_INDEX, 'r', encoding='utf-8') as f:
            content = f.read()
            existing_ids = set(re.findall(r'question(\d+)', content))

    all_ids = sorted([int(qid) for qid in existing_ids] + list(question_ids))
    # 生成完整索引...
```

#### 5. 材料内容提取过多
**问题**: `extract_passage()` 提取了材料之前的题目内容

**解决**: 使用材料标题作为锚点精确提取
```python
pattern = rf'({re.escape(passage_title)}.*?){start_q}、'
match = re.search(pattern, md_text, re.DOTALL)
```

#### 6. 答案提取遗漏
**问题**: 部分题目答案格式特殊（如第54题），正则无法匹配

**解决**: 先按题号分割文本，再在每个区块内搜索答案
```python
sections = re.split(r'\n(\d+)、', text)
for i in range(1, len(sections), 2):
    q_num = int(sections[i])
    content = sections[i+1]
    match = re.search(r'(?:故)?正确答案[为：:]\s*([A-D])', content)
```

### 数据结构

#### Question 类型
```typescript
interface Question {
  id: number
  module: string
  knowledgePoint: string
  question: string
  image?: string        // 单张图片
  images?: string[]     // 多张图片
  options: string[]
  answer: string
  passageId?: number    // 关联材料ID
  examSet?: string
}
```

#### Passage 类型
```typescript
interface Passage {
  id: number
  module: string
  title?: string
  content: string       // 支持 HTML 表格
  image?: string
  images?: string[]
  questionIds: number[] // 关联的题目ID列表
}
```

### 题库显示优化
资料分析题在题库列表中显示材料标题而非题目内容:
```typescript
const passage = q.passageId ? passages.find(p => p.id === q.passageId) : null
<p className="question-preview">
  {passage ? passage.title : q.question}
</p>
```
