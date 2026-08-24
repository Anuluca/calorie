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
    (record) => isDateKeyInRange(record.dateKey, cutoff, todayKey)
  );
}

function isDateKeyInRange(
  dateKey: string,
  cutoffDateKey: string,
  todayKey: string
): boolean {
  return dateKey >= cutoffDateKey && dateKey <= todayKey;
}

/**
 * 按本地日期聚合热量记录。校准值允许为负数，并直接参与当天总热量计算。
 */
export function summarizeIntakeDays(
  records: IntakeRecord[],
  todayKey = toLocalDateKey()
): IntakeDaySummary[] {
  const summaries = new Map<string, IntakeDaySummary>();
  const cutoff = intakeCutoffDateKey(todayKey);

  for (const record of records) {
    if (!isDateKeyInRange(record.dateKey, cutoff, todayKey)) continue;
    let summary = summaries.get(record.dateKey);
    if (!summary) {
      summary = {
        dateKey: record.dateKey,
        totalCalories: 0,
        foodCalories: 0,
        adjustmentCalories: 0,
        foodNames: [],
        recordCount: 0,
        isToday: record.dateKey === todayKey
      };
      summaries.set(record.dateKey, summary);
    }

    summary.totalCalories += record.calories;
    summary.recordCount += 1;
    if (record.kind === "food") {
      summary.foodCalories += record.calories;
      summary.foodNames.push(record.name);
    } else {
      summary.adjustmentCalories += record.calories;
    }
  }

  return [...summaries.values()]
    .sort((left, right) => right.dateKey.localeCompare(left.dateKey))
    .slice(0, INTAKE_RETENTION_DAYS);
}
