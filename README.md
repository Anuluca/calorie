# 热量快查 Demo

Vue 3、Ionic Vue、Capacitor、Cloudflare Workers AI 和 D1 实现的 iOS/Android 热量查询 Demo。

当前 Demo API：`https://calorie-api.tilucario.workers.dev`

中国大陆网络可能无法直接访问 `workers.dev`。正式部署时应给 Worker 绑定可访问的自定义域名。

## 功能

- 中文食物和份量查询
- 完全由 Workers AI 识别食物并估算份量和热量
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

## Cloudflare 初始化

不要把 Cloudflare API Token 或模型密钥写进仓库。

```bash
npx wrangler login
npx wrangler d1 create calorie-foods
```

把 `wrangler d1 create` 返回的数据库 ID 写入 `worker/wrangler.jsonc`，然后执行：

```bash
npm run db:migrate:remote --workspace worker
npm run worker:deploy
```

将部署地址写入 `mobile/.env` 后重新构建客户端。

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
