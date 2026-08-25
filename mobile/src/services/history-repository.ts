import { Preferences } from "@capacitor/preferences";
import type { FoodQueryResult } from "@/types";

const storageKey = "calorie-history-v1";
export const HISTORY_LIMIT = 200;

async function list(): Promise<FoodQueryResult[]> {
  const { value } = await Preferences.get({ key: storageKey });
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as FoodQueryResult[];
    const retained = parsed.slice(0, HISTORY_LIMIT);
    if (retained.length !== parsed.length) {
      await Preferences.set({ key: storageKey, value: JSON.stringify(retained) });
    }
    return retained;
  } catch {
    return [];
  }
}

export const historyRepository = {
  list,
  async save(items: FoodQueryResult[]) {
    await Preferences.set({
      key: storageKey,
      value: JSON.stringify(items.slice(0, HISTORY_LIMIT))
    });
  },
  async clear() {
    await Preferences.remove({ key: storageKey });
  }
};
