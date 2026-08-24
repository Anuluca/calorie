import { z } from "zod";
import type { FoodQueryResult } from "@/types";

// 与 Worker 中实际调用的模型保持一致，用于在查询页向用户明确说明。
export const AI_MODEL_DISPLAY_NAME = "智谱 GLM-4-Flash";

export const resultSchema = z.object({
  id: z.string(),
  originalQuery: z.string(),
  foodId: z.number().nullable(),
  name: z.string(),
  quantityText: z.string(),
  grams: z.number().nonnegative(),
  calories: z.number().nonnegative(),
  calorieMin: z.number().nonnegative(),
  calorieMax: z.number().nonnegative(),
  confidence: z.enum(["high", "medium", "low"]),
  source: z.literal("cloud"),
  createdAt: z.number()
});

const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/$/,
  ""
);

async function queryCloud(text: string): Promise<FoodQueryResult> {
  if (!apiBaseUrl || apiBaseUrl.includes("example.workers.dev")) {
    throw new Error("AI 服务未配置");
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 35000);

  try {
    const response = await fetch(`${apiBaseUrl}/v1/food/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new Error(payload?.message || "AI 查询失败");
    }
    return resultSchema.parse(await response.json());
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      throw new Error("AI 查询超时，请重试");
    }
    if (cause instanceof Error && cause.message !== "Failed to fetch") {
      throw cause;
    }
    throw new Error("无法连接 AI 服务");
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export async function queryFood(text: string): Promise<FoodQueryResult> {
  const normalized = text.trim().slice(0, 200);
  if (!normalized) throw new Error("请输入食物");

  return queryCloud(normalized);
}
