export type Confidence = "high" | "medium" | "low";

export interface FoodQueryResult {
  id: string;
  originalQuery: string;
  foodId: number | null;
  name: string;
  quantityText: string;
  grams: number;
  calories: number;
  calorieMin: number;
  calorieMax: number;
  confidence: Confidence;
  source: "cloud";
  createdAt: number;
}

export interface FoodIntakeRecord {
  id: string;
  kind: "food";
  dateKey: string;
  name: string;
  quantityText: string;
  calories: number;
  sourceResultId: string;
  createdAt: number;
}

export interface CalorieAdjustmentRecord {
  id: string;
  kind: "adjustment";
  dateKey: string;
  /** 正数表示增加，负数表示减少。 */
  calories: number;
  /** 本次校准填写的增加值；旧数据可能不存在。 */
  increaseCalories?: number;
  /** 本次校准填写的减少值；旧数据可能不存在。 */
  decreaseCalories?: number;
  note: string;
  createdAt: number;
}

export type IntakeRecord = FoodIntakeRecord | CalorieAdjustmentRecord;

export interface IntakeDaySummary {
  dateKey: string;
  totalCalories: number;
  foodCalories: number;
  adjustmentCalories: number;
  foodNames: string[];
  recordCount: number;
  isToday: boolean;
}
