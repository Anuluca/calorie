import type { IntakeDaySummary, IntakeRecord } from "@/types";

export const INTAKE_RETENTION_DAYS = 60;

export function toLocalDateKey(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function intakeCutoffDateKey(todayKey = toLocalDateKey()): string {
  const cutoff = new Date(`${todayKey}T12:00:00`);
  cutoff.setDate(cutoff.getDate() - (INTAKE_RETENTION_DAYS - 1));
  return toLocalDateKey(cutoff.getTime());
}

export function retainRecentIntakeRecords(
  records: IntakeRecord[],
  todayKey = toLocalDateKey()
): IntakeRecord[] {
  const cutoff = intakeCutoffDateKey(todayKey);
  return records.filter(
    (record) => record.dateKey >= cutoff && record.dateKey <= todayKey
  );
}

/**
 * 按本地日期聚合热量记录。校准值允许为负数，并直接参与当天总热量计算。
 */
export function summarizeIntakeDays(
  records: IntakeRecord[],
  todayKey = toLocalDateKey()
): IntakeDaySummary[] {
  const groups = new Map<string, IntakeRecord[]>();

  for (const record of retainRecentIntakeRecords(records, todayKey)) {
    const group = groups.get(record.dateKey) ?? [];
    group.push(record);
    groups.set(record.dateKey, group);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, INTAKE_RETENTION_DAYS)
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
