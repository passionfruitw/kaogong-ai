# Railway 部署说明

## 方法一：在 Railway 中配置根目录（推荐）

1. 访问 [railway.app](https://railway.app)，用 GitHub 登录
2. 点击 "New Project" → "Deploy from GitHub repo"
3. 选择你的仓库（整个仓库）
4. 部署后，点击项目进入设置
5. 找到 "Settings" → "Service Settings"
6. 在 "Root Directory" 中填入：`考公AI备考/backend`
7. 点击 "Save"，Railway 会自动重新部署

## 方法二：使用 railway.toml 配置文件

我已经在项目根目录创建了 `railway.toml` 配置文件，Railway 会自动识别。

直接选择仓库部署即可，无需手动配置。

## 环境变量配置

部署后，在 Railway 项目中添加以下环境变量：

```
SILICONFLOW_API_KEY=你的API密钥
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V3
PORT=8000
```

## 验证部署

访问：`https://你的项目名.railway.app/api/ai/health`

应该返回：`{"status":"ok"}`
