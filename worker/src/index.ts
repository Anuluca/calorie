import {
  calculateAiResult,
  feedbackSchema,
  requestSchema,
  type AiEstimate
} from "./domain";
import {
  estimateFoodWithZhipu,
  ZHIPU_MODEL,
  ZHIPU_PROMPT_VERSION,
  ZhipuApiError
} from "./zhipu";

interface Env {
  DB: D1Database;
  ZHIPU_API_KEY: string;
  FEEDBACK_EMAIL: SendEmail;
}

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,x-install-id",
  "access-control-max-age": "86400"
};

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
  return Response.json(data, { ...init, headers });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function handleFoodQuery(request: Request, env: Env): Promise<Response> {
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return json({ error: "INVALID_QUERY", message: "请输入食物" }, { status: 400 });
  }

  const text = body.data.text;
  // 缓存键包含模型和方案版本，避免复用旧食品库计算结果。
  const cacheKey = await sha256(
    `${ZHIPU_MODEL}:${ZHIPU_PROMPT_VERSION}:${text}`
  );
  const cached = await env.DB
    .prepare(
      "SELECT result_json FROM query_cache WHERE query_hash = ?1 AND expires_at > ?2"
    )
    .bind(cacheKey, Date.now())
    .first<{ result_json: string }>();

  if (cached) return json(JSON.parse(cached.result_json));

  let estimate: AiEstimate;
  try {
    estimate = await estimateFoodWithZhipu(env.ZHIPU_API_KEY, text);
  } catch (error) {
    console.error("Food estimation failed", {
      model: ZHIPU_MODEL,
      code: error instanceof ZhipuApiError ? error.code : "UNKNOWN",
      status: error instanceof ZhipuApiError ? error.status : undefined
    });
    const message =
      error instanceof ZhipuApiError && error.code === "RATE_LIMIT"
        ? "AI 请求繁忙，请稍后重试"
        : error instanceof ZhipuApiError && error.code === "CONFIGURATION"
          ? "AI 服务未配置"
          : "AI 暂时不可用，请稍后再试";
    return json(
      { error: "AI_UNAVAILABLE", message },
      { status: 503 }
    );
  }

  if (!estimate.recognized) {
    return json(
      { error: "NOT_FOOD", message: "请输入食物或饮料" },
      { status: 422 }
    );
  }

  const result = calculateAiResult(text, estimate);

  await env.DB
    .prepare(
      `INSERT OR REPLACE INTO query_cache
       (query_hash, result_json, expires_at)
       VALUES (?1, ?2, ?3)`
    )
    .bind(
      cacheKey,
      JSON.stringify(result),
      Date.now() + 7 * 24 * 60 * 60 * 1000
    )
    .run();

  return json(result);
}

async function handleFeedback(request: Request, env: Env): Promise<Response> {
  const installId = request.headers.get("x-install-id")?.trim() ?? "";
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(installId)) {
    return json({ error: "INVALID_INSTALL", message: "反馈来源无效" }, { status: 400 });
  }

  const body = feedbackSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return json({ error: "INVALID_FEEDBACK", message: "请填写有效的标题和内容" }, { status: 400 });
  }

  // 每个安装实例与网络地址每天最多发送三次，避免公开接口被用于邮件轰炸。
  const address = request.headers.get("cf-connecting-ip") ?? "unknown";
  const dateKey = new Date().toISOString().slice(0, 10);
  const rateKey = await sha256(`feedback:${installId}:${address}:${dateKey}`);
  const rate = await env.DB
    .prepare(
      `INSERT INTO feedback_rate_limits (rate_key, request_count, updated_at)
       VALUES (?1, 1, ?2)
       ON CONFLICT(rate_key) DO UPDATE SET
         request_count = request_count + 1,
         updated_at = excluded.updated_at
       RETURNING request_count`
    )
    .bind(rateKey, Date.now())
    .first<{ request_count: number }>();

  if ((rate?.request_count ?? 1) > 3) {
    return json({ error: "RATE_LIMITED", message: "今天的反馈次数已用完" }, { status: 429 });
  }

  try {
    await env.FEEDBACK_EMAIL.send({
      to: "tilucario@outlook.com",
      from: { email: "feedback@anuluca.com", name: "热量快查" },
      subject: `[热量快查反馈] ${body.data.title}`,
      text: [
        body.data.content,
        "",
        `安装标识：${installId}`,
        `提交时间：${new Date().toISOString()}`
      ].join("\n")
    });
  } catch (error) {
    console.error("Feedback email failed", error);
    return json({ error: "EMAIL_FAILED", message: "反馈发送失败，请稍后重试" }, { status: 503 });
  }

  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/health") {
      return json({ ok: true, mode: "ai", model: ZHIPU_MODEL });
    }

    if (request.method === "POST" && pathname === "/v1/food/query") {
      return handleFoodQuery(request, env);
    }

    if (request.method === "POST" && pathname === "/v1/feedback") {
      return handleFeedback(request, env);
    }

    return json({ error: "NOT_FOUND" }, { status: 404 });
  }
} satisfies ExportedHandler<Env>;
