import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { Preferences } from "@capacitor/preferences";
import {
  HISTORY_LIMIT,
  historyRepository
} from "@/services/history-repository";
import { createSerialTaskQueue } from "@/services/serial-task-queue";
import type { FoodQueryResult } from "@/types";

const comparisonLockKey = "calorie-comparison-lock-v1";

export const useHistoryStore = defineStore("history", () => {
  const items = ref<FoodQueryResult[]>([]);
  const lockedComparison = ref<FoodQueryResult | null>(null);
  const ready = ref(false);
  let loadPromise: Promise<void> | null = null;
  const enqueueMutation = createSerialTaskQueue();

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
    await enqueueMutation(async () => {
      await load();
      const next = [item, ...items.value.filter((value) => value.id !== item.id)]
        .slice(0, HISTORY_LIMIT);
      await historyRepository.save(next);
      items.value = next;
    });
  }

  async function clear() {
    await enqueueMutation(async () => {
      await load();
      await Promise.all([
        historyRepository.clear(),
        Preferences.remove({ key: comparisonLockKey })
      ]);
      items.value = [];
      lockedComparison.value = null;
      ready.value = true;
    });
  }

  async function remove(id: string) {
    await enqueueMutation(async () => {
      await load();
      const removesLock = lockedComparison.value?.id === id;
      const next = items.value.filter((item) => item.id !== id);
      await Promise.all([
        historyRepository.save(next),
        removesLock
          ? Preferences.remove({ key: comparisonLockKey })
          : Promise.resolve()
      ]);
      items.value = next;
      if (removesLock) lockedComparison.value = null;
    });
  }

  async function lockComparison(item: FoodQueryResult) {
    await enqueueMutation(async () => {
      await load();
      await Preferences.set({ key: comparisonLockKey, value: JSON.stringify(item) });
      lockedComparison.value = item;
    });
  }

  async function unlockComparison() {
    await enqueueMutation(async () => {
      await load();
      await Preferences.remove({ key: comparisonLockKey });
      lockedComparison.value = null;
    });
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
