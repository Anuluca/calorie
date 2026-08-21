import { describe, expect, it } from "vitest";
import { compareCalories } from "./calorie-comparison";

describe("calorie comparison", () => {
  it("treats a difference of exactly 50 kcal as approximately equal", () => {
    expect(compareCalories(500, 550).symbol).toBe("≈");
  });

  it("uses less-than when the latest result is over 50 kcal higher", () => {
    expect(compareCalories(500, 551)).toMatchObject({
      symbol: "<",
      difference: 51
    });
  });

  it("uses greater-than when the previous result is over 50 kcal higher", () => {
    expect(compareCalories(620, 500)).toMatchObject({
      symbol: ">",
      difference: 120
    });
  });
});
