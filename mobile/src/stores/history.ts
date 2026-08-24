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
  let loadPromise: Promise<void> | null = null;

  const count = computed(() => items.value.length);

  async function load() {
    if (ready.value) return;
    if (!loadPromise) {
      loadPromise = (async () => {
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
      })().finally(() => {
        loadPromise = null;
      });
    }
    await loadPromise;
  }

  async function add(item: FoodQueryResult) {
    await historyRepository.add(item);
    items.value = [item, ...items.value.filter((value) => value.id !== item.id)].slice(0, 200);
  }

  async function clear() {
    await Promise.all([
      historyRepository.clear(),
      Preferences.remove({ key: comparisonLockKey })
    ]);
    items.value = [];
    lockedComparison.value = null;
  }

  async function remove(id: string) {
    const removesLock = lockedComparison.value?.id === id;
    await Promise.all([
      historyRepository.remove(id),
      removesLock
        ? Preferences.remove({ key: comparisonLockKey })
        : Promise.resolve()
    ]);
    items.value = items.value.filter((item) => item.id !== id);
    if (removesLock) {
      lockedComparison.value = null;
    }
  }

  async function lockComparison(item: FoodQueryResult) {
    await Preferences.set({ key: comparisonLockKey, value: JSON.stringify(item) });
    lockedComparison.value = item;
  }

  async function unlockComparison() {
    await Preferences.remove({ key: comparisonLockKey });
    lockedComparison.value = null;
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
