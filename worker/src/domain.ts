import { z } from "zod";

export type Confidence = "high" | "medium" | "low";

export const aiEstimateSchema = z
  .object({
    recognized: z.boolean(),
    foodName: z.string().max(80),
    quantityText: z.string().max(40),
    grams: z.number().min(0).max(100000),
    kcalPer100g: z.number().min(0).max(1000),
    confidence: z.enum(["high", "medium", "low"]),
    uncertaintyPercent: z.number().min(5).max(50)
  })
  .refine(
    (value) =>
      !value.recognized ||
      (value.foodName.length > 0 && value.grams > 0 && value.kcalPer100g >= 0),
    { message: "识别成功时必须返回有效的食品营养估算" }
  );

export type AiEstimate = z.infer<typeof aiEstimateSchema>;

export const requestSchema = z.object({
  text: z.string().trim().min(1).max(200)
});

export const feedbackSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine((value) => !/[\r\n]/.test(value), "标题不能包含换行"),
  content: z.string().trim().min(1).max(2000)
});

/** Worker 响应和 D1 缓存共用同一份边界 Schema，避免读取损坏或旧版缓存。 */
export const foodQueryResultSchema = z.object({
  id: z.string().min(1),
  originalQuery: z.string(),
  foodId: z.null(),
  name: z.string().min(1),
  quantityText: z.string(),
  grams: z.number().nonnegative(),
  calories: z.number().nonnegative(),
  calorieMin: z.number().nonnegative(),
  calorieMax: z.number().nonnegative(),
  confidence: z.enum(["high", "medium", "low"]),
  source: z.literal("cloud"),
  createdAt: z.number().nonnegative()
});

export function calculateAiResult(
  originalQuery: string,
  estimate: AiEstimate,
  now = Date.now(),
  id: string = crypto.randomUUID()
) {
  if (!estimate.recognized) throw new Error("NOT_FOOD");

  const grams = Math.round(estimate.grams);
  const calories = Math.round((estimate.kcalPer100g * grams) / 100);
  const ratio = estimate.uncertaintyPercent / 100;

  return foodQueryResultSchema.parse({
    id,
    originalQuery,
    foodId: null,
    name: estimate.foodName,
    quantityText: estimate.quantityText || `约 ${grams} 克`,
    grams,
    calories,
    calorieMin: Math.max(0, Math.round(calories * (1 - ratio))),
    calorieMax: Math.round(calories * (1 + ratio)),
    confidence: estimate.confidence,
    source: "cloud" as const,
    createdAt: now
  });
}

export function safeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
