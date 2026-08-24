export type CalorieComparisonSymbol = "<" | ">" | "≈";

export interface CalorieComparison {
  symbol: CalorieComparisonSymbol;
  difference: number;
  summary: string;
  ariaLabel: string;
}

/** 将当前份量热量统一换算为每 100 克热量，供同等重量比较。 */
export function caloriesPer100Grams(calories: number, grams: number): number {
  if (!Number.isFinite(calories) || !Number.isFinite(grams) || grams <= 0) return 0;
  return Math.round((calories * 100) / grams);
}

/**
 * 比较方向固定为“上一条结果 [符号] 最新结果”。
 * 绝对差值不超过 50 大卡时视为近似相等，避免小幅估算误差造成误导。
 */
export function compareCalories(previous: number, latest: number): CalorieComparison {
  const difference = Math.abs(previous - latest);

  if (difference <= 50) {
    return {
      symbol: "≈",
      difference,
      summary: "差不多",
      ariaLabel: `上一条与最新结果约等于，相差 ${difference} 大卡`
    };
  }

  if (previous > latest) {
    return {
      symbol: ">",
      difference,
      summary: `少了 ${difference} 大卡`,
      ariaLabel: `上一条结果大于最新结果 ${difference} 大卡`
    };
  }

  return {
    symbol: "<",
    difference,
    summary: `多了 ${difference} 大卡`,
    ariaLabel: `上一条结果小于最新结果 ${difference} 大卡`
  };
}
