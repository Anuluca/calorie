import { describe, expect, it } from "vitest";
import {
  aiEstimateSchema,
  calculateAiResult
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
});
