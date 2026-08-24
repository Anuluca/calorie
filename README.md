# 热量快查 Demo

Vue 3、Ionic Vue、Capacitor、Cloudflare Workers、智谱 GLM-4.7-Flash 和 D1 实现的 iOS/Android 热量查询 Demo。

当前 Demo API：`https://calorie-api.tilucario.workers.dev`

中国大陆网络可能无法直接访问 `workers.dev`。正式部署时应给 Worker 绑定可访问的自定义域名。

## 功能

- 中文食物和份量查询
- 由智谱 GLM-4.7-Flash 识别食物并估算份量和热量
- 整份成品热量估算、结构化输出校验和服务端确定性换算
- 本地 SQLite 历史；Web 开发环境自动使用 Preferences
- 结构化输出校验和热量区间计算
- D1 AI 结果缓存
- 深色模式、动态安全区和 iOS 风格界面

结果由 AI 估算，只用于验证产品流程，不构成医疗或营养建议。

## 本地运行

```bash
npm install
npm run worker:dev
npm run dev
```

客户端默认不调用示例域名。复制环境文件并填写本地 Worker 地址：

```bash
cp mobile/.env.example mobile/.env
```

```text
VITE_API_BASE_URL=http://localhost:8787
```

## 智谱与 Cloudflare 初始化

不要把 Cloudflare API Token 或智谱 API Key 写进仓库。

在智谱开放平台创建 API Key。本地开发时新建 `worker/.dev.vars`：

```text
ZHIPU_API_KEY=你的智谱API Key
```

`.dev.vars` 已被 Git 忽略。生产环境使用 Cloudflare Secret，不要把密钥写入 `wrangler.jsonc`。先登录 Cloudflare，再设置密钥并初始化 D1：

```bash
cd worker
npx wrangler login
npx wrangler secret put ZHIPU_API_KEY
npx wrangler d1 create calorie-foods
cd ..
```

把 `wrangler d1 create` 返回的数据库 ID 写入 `worker/wrangler.jsonc`，然后执行：

```bash
npm run db:migrate:remote --workspace worker
npm run worker:deploy
```

将部署地址写入 `mobile/.env` 后重新构建客户端。

### Bug 反馈邮件

反馈接口通过 Cloudflare Email Service 的 `FEEDBACK_EMAIL` 绑定发送邮件。部署前需要：

1. 在 Cloudflare Email Service 中启用 `anuluca.com` 发件域，并允许 `feedback@anuluca.com`。
2. 将 `tilucario@outlook.com` 添加为已验证的目标地址。
3. 先运行 D1 迁移，再部署 Worker：

```bash
npm run db:migrate:remote --workspace worker
npm run worker:deploy
```

## 原生工程

```bash
npm run native:sync
```

首次创建平台时：

```bash
cd mobile
npx cap add ios
npx cap add android
npx cap sync
```

iOS 真机包需要完整 Xcode 和 Apple 签名。Android APK 需要 JDK 及 Android SDK。

## 检查

```bash
npm run test
npm run build
```
