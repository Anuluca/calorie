import { describe, expect, it } from "vitest";
import { summarizeIntakeDays } from "./intake-domain";
import type { IntakeRecord } from "@/types";

const records: IntakeRecord[] = [
  {
    id: "food-1",
    kind: "food",
    dateKey: "2026-08-21",
    name: "热干面",
    quantityText: "1碗",
    calories: 520,
    sourceResultId: "query-1",
    createdAt: 2
  },
  {
    id: "adjustment-1",
    kind: "adjustment",
    dateKey: "2026-08-21",
    calories: -180,
    increaseCalories: 20,
    decreaseCalories: 200,
    note: "公园跑步",
    createdAt: 3
  },
  {
    id: "adjustment-2",
    kind: "adjustment",
    dateKey: "2026-08-21",
    calories: 50,
    increaseCalories: 80,
    decreaseCalories: 30,
    note: "补充估算",
    createdAt: 4
  }
];

describe("intake day summaries", () => {
  it("includes every adjustment in the daily total", () => {
    expect(summarizeIntakeDays(records, "2026-08-21")[0]).toMatchObject({
      totalCalories: 390,
      foodCalories: 520,
      adjustmentCalories: -130,
      recordCount: 3,
      isToday: true
    });
  });

  it("keeps only the most recent 60 calendar days", () => {
    const today = new Date("2026-08-21T12:00:00");
    const manyDays: IntakeRecord[] = Array.from({ length: 61 }, (_, index) => {
      const date = new Date(today);
      date.setDate(date.getDate() - index);
      const dateKey = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
      ].join("-");

      return {
      id: `food-${index}`,
      kind: "food" as const,
      dateKey,
      name: "测试食物",
      quantityText: "1份",
      calories: 100,
      sourceResultId: `query-${index}`,
      createdAt: index
      };
    });

    const summaries = summarizeIntakeDays(manyDays, "2026-08-21");
    expect(summaries).toHaveLength(60);
    expect(summaries[0]!.dateKey).toBe("2026-08-21");
    expect(summaries[summaries.length - 1]!.dateKey).toBe("2026-06-23");
  });
});
