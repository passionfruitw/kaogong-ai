# 部署指南

本文档介绍如何将考公AI备考助手部署到外网（Vercel + Railway方案）。

## 部署架构

- **前端**: Vercel（免费托管，自动HTTPS，全球CDN）
- **后端**: Railway（免费额度500小时/月，自动HTTPS）

## 一、后端部署（Railway）

### 1. 准备工作

确保后端代码已推送到 GitHub 仓库。

### 2. 部署到 Railway

1. 访问 [railway.app](https://railway.app) 并登录（使用 GitHub 账号）

2. 点击 "New Project" → "Deploy from GitHub repo"

3. 选择你的仓库，选择 `backend` 目录

4. Railway 会自动检测到 Python 项目并开始部署

5. **配置环境变量**：
   - 在 Railway 项目页面，点击 "Variables"
   - 添加以下环境变量：
     ```
     SILICONFLOW_API_KEY=你的硅基流动API密钥
     SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
     SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V3
     PORT=8000
     ```

6. 等待部署完成，Railway 会提供一个公网地址，例如：
   ```
   https://your-app-name.railway.app
   ```

7. **测试后端**：
   访问 `https://your-app-name.railway.app/api/ai/health` 确认后端正常运行

### 3. 配置 CORS（如果需要）

后端 `main.py` 已配置 CORS，允许所有来源访问。生产环境建议限制为前端域名：

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend.vercel.app"],  # 改为你的前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 二、前端部署（Vercel）

### 1. 配置后端地址

在 `frontend` 目录创建 `.env.production` 文件：

```bash
VITE_API_URL=https://your-app-name.railway.app/api
```

将 `your-app-name` 替换为你的 Railway 后端地址。

### 2. 更新 vercel.json

编辑 `frontend/vercel.json`，将后端地址改为你的 Railway 地址：

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-app-name.railway.app/api/:path*"
    }
  ]
}
```

### 3. 部署到 Vercel

1. 访问 [vercel.com](https://vercel.com) 并登录（使用 GitHub 账号）

2. 点击 "Add New..." → "Project"

3. 导入你的 GitHub 仓库

4. **配置项目**：
   - Framework Preset: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

5. **添加环境变量**：
   - 点击 "Environment Variables"
   - 添加：
     ```
     VITE_API_URL=https://your-app-name.railway.app/api
     ```

6. 点击 "Deploy" 开始部署

7. 等待部署完成，Vercel 会提供一个公网地址，例如：
   ```
   https://your-project.vercel.app
   ```

### 4. 配置自定义域名（可选）

在 Vercel 项目设置中，可以添加自定义域名：
1. 点击 "Settings" → "Domains"
2. 添加你的域名（如 `kaogong.example.com`）
3. 按照提示配置 DNS 记录

## 三、验证部署

1. 访问前端地址：`https://your-project.vercel.app`

2. 测试功能：
   - 浏览题库
   - 开始练习
   - 测试 AI 功能（错题解析、举一反三等）

3. 检查浏览器控制台，确认没有 API 请求错误

## 四、常见问题

### 1. API 请求失败（CORS 错误）

**原因**：后端 CORS 配置不正确

**解决**：
- 检查后端 `main.py` 的 CORS 配置
- 确保 `allow_origins` 包含前端域名
- Railway 重新部署后端

### 2. 前端无法连接后端

**原因**：环境变量配置错误

**解决**：
- 检查 Vercel 环境变量 `VITE_API_URL` 是否正确
- 检查 `vercel.json` 的 rewrites 配置
- 重新部署前端

### 3. Railway 后端冷启动慢

**原因**：Railway 免费版会在无请求时休眠

**解决**：
- 升级到 Railway Pro 计划（$5/月）
- 或使用定时任务保持后端活跃（每 10 分钟请求一次 health 接口）

### 4. 图片无法显示

**原因**：图片路径配置问题

**解决**：
- 确保图片在 `frontend/public/images/` 目录
- 检查题目数据中的图片路径是否正确（应为 `/images/xxx.jpg`）

## 五、成本估算

### 免费额度

- **Vercel**: 
  - 100GB 带宽/月
  - 无限部署次数
  - 自动 HTTPS

- **Railway**:
  - 500 小时/月（约 20 天）
  - 512MB 内存
  - 1GB 磁盘

### 付费方案（如需要）

- **Vercel Pro**: $20/月
  - 1TB 带宽
  - 更多并发构建

- **Railway Pro**: $5/月起
  - 无休眠
  - 更多资源

## 六、监控与维护

### 1. 日志查看

- **Railway**: 项目页面 → "Deployments" → 点击部署 → "Logs"
- **Vercel**: 项目页面 → "Deployments" → 点击部署 → "Logs"

### 2. 性能监控

- Vercel 自带 Analytics（需升级 Pro）
- 可集成第三方监控服务（如 Sentry）

### 3. 自动部署

- 推送到 GitHub 主分支会自动触发部署
- 可在 Vercel/Railway 设置中配置部署分支

## 七、安全建议

1. **API 密钥保护**：
   - 不要将 API 密钥提交到 Git
   - 使用环境变量管理敏感信息

2. **CORS 限制**：
   - 生产环境限制 CORS 为前端域名

3. **速率限制**：
   - 考虑添加 API 速率限制防止滥用

4. **HTTPS**：
   - Vercel 和 Railway 都自动提供 HTTPS

## 八、下一步

部署完成后，你可以：

1. 配置自定义域名
2. 添加 Google Analytics 统计
3. 集成错误监控（Sentry）
4. 优化 SEO（添加 meta 标签）
5. 添加 PWA 支持（离线访问）

---

**部署完成！** 🎉

如有问题，请查看：
- [Vercel 文档](https://vercel.com/docs)
- [Railway 文档](https://docs.railway.app)
