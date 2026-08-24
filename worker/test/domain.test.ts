import { describe, expect, it } from "vitest";
import {
  aiEstimateSchema,
  calculateAiResult,
  feedbackSchema
} from "../src/domain";

describe("calculateAiResult", () => {
  const estimate = {
    recognized: true,
    foodName: "水煮鸡蛋",
    quantityText: "2个",
    grams: 100,
    kcalPer100g: 143,
    confidence: "medium" as const,
    uncertaintyPercent: 15
  };

  it("calculates calories from the AI estimate", () => {
    const result = calculateAiResult("两个水煮鸡蛋", estimate, 1, "test-id");

    expect(result.calories).toBe(143);
    expect(result.grams).toBe(100);
    expect(result.quantityText).toBe("2个");
    expect(result.foodId).toBeNull();
    expect(result.source).toBe("cloud");
  });

  it("calculates the AI uncertainty range", () => {
    const result = calculateAiResult("两个水煮鸡蛋", estimate, 1, "test-id");
    expect(result.calorieMin).toBe(122);
    expect(result.calorieMax).toBe(164);
  });

  it("rejects an invalid recognized estimate", () => {
    expect(() =>
      aiEstimateSchema.parse({ ...estimate, grams: 0 })
    ).toThrow();
  });

  it("accepts a recognized zero-calorie drink", () => {
    expect(
      calculateAiResult("500毫升水", {
        ...estimate,
        foodName: "水",
        quantityText: "500毫升",
        grams: 500,
        kcalPer100g: 0
      }).calories
    ).toBe(0);
  });
});

describe("feedbackSchema", () => {
  it("accepts a valid feedback message", () => {
    expect(feedbackSchema.parse({ title: "无法保存", content: "点击记录后没有反应" }))
      .toEqual({ title: "无法保存", content: "点击记录后没有反应" });
  });

  it("rejects a subject containing a newline", () => {
    expect(() => feedbackSchema.parse({ title: "问题\n抄送", content: "内容" })).toThrow();
  });
});
