import { Preferences } from "@capacitor/preferences";
import type { IntakeRecord } from "@/types";
import { retainRecentIntakeRecords } from "@/services/intake-domain";

const storageKey = "calorie-intake-records-v1";

function normalizeRecord(record: IntakeRecord): IntakeRecord {
  if (record.kind !== "adjustment") return record;

  return {
    ...record,
    increaseCalories: record.increaseCalories ?? Math.max(record.calories, 0),
    decreaseCalories: record.decreaseCalories ?? Math.max(-record.calories, 0)
  };
}

async function list(): Promise<IntakeRecord[]> {
  const { value } = await Preferences.get({ key: storageKey });
  if (!value) return [];

  try {
    const parsed = (JSON.parse(value) as IntakeRecord[]).map(normalizeRecord);
    const retained = retainRecentIntakeRecords(parsed);
    if (retained.length !== parsed.length) {
      await Preferences.set({ key: storageKey, value: JSON.stringify(retained) });
    }
    return retained;
  } catch {
    return [];
  }
}

export const intakeRepository = {
  list,
  async save(records: IntakeRecord[]) {
    await Preferences.set({
      key: storageKey,
      value: JSON.stringify(retainRecentIntakeRecords(records))
    });
  },
  async clear() {
    await Preferences.remove({ key: storageKey });
  }
};
