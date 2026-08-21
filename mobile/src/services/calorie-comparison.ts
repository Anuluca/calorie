export type CalorieComparisonSymbol = "<" | ">" | "≈";

export interface CalorieComparison {
  symbol: CalorieComparisonSymbol;
  difference: number;
  summary: string;
  ariaLabel: string;
}

/**
 * 比较方向固定为“上一条结果 [符号] 最新结果”。
 * 绝对差值不超过 50 千卡时视为近似相等，避免小幅估算误差造成误导。
 */
export function compareCalories(previous: number, latest: number): CalorieComparison {
  const difference = Math.abs(previous - latest);

  if (difference <= 50) {
    return {
      symbol: "≈",
      difference,
      summary: `相差 ${difference} 千卡`,
      ariaLabel: `上一条与最新结果约等于，相差 ${difference} 千卡`
    };
  }

  if (previous > latest) {
    return {
      symbol: ">",
      difference,
      summary: `上一条高 ${difference} 千卡`,
      ariaLabel: `上一条结果大于最新结果 ${difference} 千卡`
    };
  }

  return {
    symbol: "<",
    difference,
    summary: `最新高 ${difference} 千卡`,
    ariaLabel: `上一条结果小于最新结果 ${difference} 千卡`
  };
}
