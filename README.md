# 考公AI备考助手

> 具备AI苏格拉底式教学法的智能考公备考平台

---

## 项目介绍

考公AI备考助手是一款面向国考/省考考生的智能备考Web应用，通过AI技术实现个性化学习辅导。

### 核心特色

- **AI智能解析**：拍照/输入错题，AI深度分析解题思路
- **举一反三**：基于错题自动生成同类变式题
- **苏格拉底教学**：AI引导式提问，真正理解知识点
- **学习追踪**：完整记录学习轨迹，掌握薄弱环节

---

## 项目结构

```
考公AI备考/
├── sessions/                    # 每日学习会话
│   ├── 2025-03-11/              # 按日期存储
│   │   └── SESSION-001.md       # 具体会话记录
│   └── SESSION-TEMPLATE.md      # 会话模板
├── progress/                    # 进度追踪
│   └── study-tracker.md         # 知识点掌握情况
├── prd/                         # 产品需求文档
│   └── PRD.md                   # 完整PRD
├── docs/                        # 设计文档（待创建）
├── CLAUDE.md                    # AI教学助手配置
└──README.md                     # 项目说明
```

---

## 快速开始

### 环境要求
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+

### 安装步骤

```bash
# 1. 克隆项目
git clone <repository-url>
cd 考公AI备考

# 2. 安装前端依赖
cd frontend
npm install

# 3. 安装后端依赖
cd ../backend
pip install -r requirements.txt

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置数据库和API密钥

# 5. 启动开发服务器
# 前端
npm run dev
# 后端
python main.py
```

---

## 功能说明

### 1. 题库练习
- 行测五大模块：言语、数量、判断、资料、常识
- 章节练习 + 专项训练 + 模拟考试
- 历年真题库

### 2. AI错题解析
- 支持文字/截图输入错题
- AI分析考点、错误原因、解题步骤
- 关联同知识点其他题目

### 3. 举一反三
- 自动生成3-5道变式题
- 难度分级：基础/进阶/挑战

### 4. 苏格拉底教学
- Step 1: 诊断 - "先问你知道什么"
- Step 2: 讲解 - ~200字精炼讲解
- Step 3: 验证 - 追问确认理解
- Step 4: 记录 - 追踪学习轨迹

### 5. 学习追踪
- 知识点掌握雷达图
- 错题统计分析
- 个性化复习建议

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React + TypeScript + Tailwind CSS |
| 后端 | Python FastAPI + Node.js |
| AI | LLM API + RAG（知识库检索） |
| 数据库 | PostgreSQL + Redis |
| 部署 | Docker + Nginx |

---

## 贡献指南

欢迎提交Issue和Pull Request！

### 提交规范
1. 创建feature分支：`git checkout -b feature/功能名`
2. 提交更改：`git commit -m '添加XXX功能'`
3. 推送分支：`git push origin feature/功能名`
4. 提交Pull Request

---

## 更新日志

### v1.0 (2025-03-11)
- 完成PRD文档
- 完成AI教学助手配置CLAUDE.md
- 完成学习会话模板
- 完成进度追踪模板

---

## 许可证

MIT License

---

## 联系方式

- 邮箱：contact@example.com
- 问题反馈：https://github.com/example/issues

---

**祝大家备考顺利，成功上岸！** 🎯