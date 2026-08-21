import type { IntakeDaySummary, IntakeRecord } from "@/types";

export function toLocalDateKey(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 按本地日期聚合热量记录。校准值允许为负数，并直接参与当天总热量计算。
 */
export function summarizeIntakeDays(
  records: IntakeRecord[],
  todayKey = toLocalDateKey()
): IntakeDaySummary[] {
  const groups = new Map<string, IntakeRecord[]>();

  for (const record of records) {
    const group = groups.get(record.dateKey) ?? [];
    group.push(record);
    groups.set(record.dateKey, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, 30)
    .map(([dateKey, dayRecords]) => {
      const foodRecords = dayRecords.filter((record) => record.kind === "food");
      const adjustmentRecords = dayRecords.filter(
        (record) => record.kind === "adjustment"
      );
      const foodCalories = foodRecords.reduce(
        (total, record) => total + record.calories,
        0
      );
      const adjustmentCalories = adjustmentRecords.reduce(
        (total, record) => total + record.calories,
        0
      );

      return {
        dateKey,
        totalCalories: foodCalories + adjustmentCalories,
        foodCalories,
        adjustmentCalories,
        foodNames: foodRecords.map((record) => record.name),
        recordCount: dayRecords.length,
        isToday: dateKey === todayKey
      };
    });
}
