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
    note: "公园跑步",
    createdAt: 3
  },
  {
    id: "adjustment-2",
    kind: "adjustment",
    dateKey: "2026-08-21",
    calories: 50,
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

  it("keeps only the most recent 30 recorded days", () => {
    const manyDays: IntakeRecord[] = Array.from({ length: 31 }, (_, index) => ({
      id: `food-${index}`,
      kind: "food" as const,
      dateKey: `2026-07-${String(index + 1).padStart(2, "0")}`,
      name: "测试食物",
      quantityText: "1份",
      calories: 100,
      sourceResultId: `query-${index}`,
      createdAt: index
    }));

    const summaries = summarizeIntakeDays(manyDays, "2026-08-21");
    expect(summaries).toHaveLength(30);
    expect(summaries[0]!.dateKey).toBe("2026-07-31");
    expect(summaries[summaries.length - 1]!.dateKey).toBe("2026-07-02");
  });
});
