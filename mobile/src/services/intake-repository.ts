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
  async add(record: IntakeRecord) {
    const records = retainRecentIntakeRecords([record, ...(await list())]);
    await Preferences.set({ key: storageKey, value: JSON.stringify(records) });
  },
  async remove(id: string) {
    const records = (await list()).filter((record) => record.id !== id);
    await Preferences.set({ key: storageKey, value: JSON.stringify(records) });
  },
  async clear() {
    await Preferences.remove({ key: storageKey });
  }
};
