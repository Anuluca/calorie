import { Preferences } from "@capacitor/preferences";
import type { FoodQueryResult } from "@/types";

const storageKey = "calorie-history-v1";
const historyLimit = 200;

async function list(): Promise<FoodQueryResult[]> {
  const { value } = await Preferences.get({ key: storageKey });
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as FoodQueryResult[];
    const retained = parsed.slice(0, historyLimit);
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
  async add(item: FoodQueryResult) {
    const next = [item, ...(await list())].slice(0, historyLimit);
    await Preferences.set({ key: storageKey, value: JSON.stringify(next) });
  },
  async remove(id: string) {
    const next = (await list()).filter((item) => item.id !== id);
    await Preferences.set({ key: storageKey, value: JSON.stringify(next) });
  },
  async clear() {
    await Preferences.remove({ key: storageKey });
  }
};
