import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { Preferences } from "@capacitor/preferences";
import { historyRepository } from "@/services/history-repository";
import type { FoodQueryResult } from "@/types";

const comparisonLockKey = "calorie-comparison-lock-v1";

export const useHistoryStore = defineStore("history", () => {
  const items = ref<FoodQueryResult[]>([]);
  const lockedComparison = ref<FoodQueryResult | null>(null);
  const ready = ref(false);

  const count = computed(() => items.value.length);

  async function load() {
    if (ready.value) return;
    const [storedItems, lockResult] = await Promise.all([
      historyRepository.list(),
      Preferences.get({ key: comparisonLockKey })
    ]);
    items.value = storedItems;
    try {
      lockedComparison.value = lockResult.value
        ? (JSON.parse(lockResult.value) as FoodQueryResult)
        : null;
    } catch {
      lockedComparison.value = null;
      await Preferences.remove({ key: comparisonLockKey });
    }
    ready.value = true;
  }

  async function add(item: FoodQueryResult) {
    items.value = [item, ...items.value.filter((value) => value.id !== item.id)].slice(0, 200);
    await historyRepository.add(item);
  }

  async function clear() {
    items.value = [];
    lockedComparison.value = null;
    await Promise.all([
      historyRepository.clear(),
      Preferences.remove({ key: comparisonLockKey })
    ]);
  }

  async function remove(id: string) {
    items.value = items.value.filter((item) => item.id !== id);
    if (lockedComparison.value?.id === id) {
      lockedComparison.value = null;
      await Preferences.remove({ key: comparisonLockKey });
    }
    await historyRepository.remove(id);
  }

  async function lockComparison(item: FoodQueryResult) {
    lockedComparison.value = item;
    await Preferences.set({ key: comparisonLockKey, value: JSON.stringify(item) });
  }

  async function unlockComparison() {
    lockedComparison.value = null;
    await Preferences.remove({ key: comparisonLockKey });
  }

  return {
    items,
    count,
    lockedComparison,
    ready,
    load,
    add,
    clear,
    remove,
    lockComparison,
    unlockComparison
  };
});
