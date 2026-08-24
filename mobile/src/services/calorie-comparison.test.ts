import { describe, expect, it } from "vitest";
import { caloriesPer100Grams, compareCalories } from "./calorie-comparison";

describe("calorie comparison", () => {
  it("treats a difference of exactly 50 kcal as approximately equal", () => {
    expect(compareCalories(500, 550)).toMatchObject({
      symbol: "≈",
      summary: "差不多"
    });
  });

  it("uses less-than when the latest result is over 50 kcal higher", () => {
    expect(compareCalories(500, 551)).toMatchObject({
      symbol: "<",
      difference: 51,
      summary: "多了 51 大卡"
    });
  });

  it("uses greater-than when the previous result is over 50 kcal higher", () => {
    expect(compareCalories(620, 500)).toMatchObject({
      symbol: ">",
      difference: 120,
      summary: "少了 120 大卡"
    });
  });
});

describe("caloriesPer100Grams", () => {
  it("normalizes a serving to 100 grams", () => {
    expect(caloriesPer100Grams(420, 300)).toBe(140);
  });

  it("returns zero when weight is unavailable", () => {
    expect(caloriesPer100Grams(420, 0)).toBe(0);
  });
});
