import { describe, expect, it } from "vitest";
import { resultSchema } from "./query-service";

const validResult = {
  id: "test-id",
  originalQuery: "一碗牛肉面",
  foodId: null,
  name: "牛肉面",
  quantityText: "1碗",
  grams: 500,
  calories: 620,
  calorieMin: 527,
  calorieMax: 713,
  confidence: "medium",
  source: "cloud",
  createdAt: 1
};

describe("AI query result", () => {
  it("accepts a valid cloud result", () => {
    expect(resultSchema.parse(validResult).calories).toBe(620);
  });

  it("rejects a local result", () => {
    expect(() => resultSchema.parse({ ...validResult, source: "local" })).toThrow();
  });

  it("rejects an invalid confidence value", () => {
    expect(() =>
      resultSchema.parse({ ...validResult, confidence: "unknown" })
    ).toThrow();
  });
});
