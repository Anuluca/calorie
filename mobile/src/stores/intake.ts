import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { intakeRepository } from "@/services/intake-repository";
import { summarizeIntakeDays, toLocalDateKey } from "@/services/intake-domain";
import type { FoodQueryResult, IntakeRecord } from "@/types";

function createRecordId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export const useIntakeStore = defineStore("intake", () => {
  const records = ref<IntakeRecord[]>([]);
  const ready = ref(false);
  const days = computed(() => summarizeIntakeDays(records.value));
  const recordsByDay = computed(() => {
    const index = new Map<string, IntakeRecord[]>();
    for (const record of records.value) {
      const dayRecords = index.get(record.dateKey);
      if (dayRecords) dayRecords.push(record);
      else index.set(record.dateKey, [record]);
    }
    for (const dayRecords of index.values()) {
      dayRecords.sort((left, right) => right.createdAt - left.createdAt);
    }
    return index;
  });
  let loadPromise: Promise<void> | null = null;

  async function load() {
    if (ready.value) return;
    if (!loadPromise) {
      loadPromise = intakeRepository
        .list()
        .then((storedRecords) => {
          records.value = storedRecords;
          ready.value = true;
        })
        .finally(() => {
          loadPromise = null;
        });
    }
    await loadPromise;
  }

  async function addFood(result: FoodQueryResult) {
    const now = Date.now();
    const record: IntakeRecord = {
      id: createRecordId("food"),
      kind: "food",
      dateKey: toLocalDateKey(now),
      name: result.name,
      quantityText: result.quantityText,
      calories: result.calories,
      sourceResultId: result.id,
      createdAt: now
    };

    await intakeRepository.add(record);
    records.value = [record, ...records.value];
  }

  async function addAdjustment(
    dateKey: string,
    increaseCalories: number,
    decreaseCalories: number,
    note: string
  ) {
    const record: IntakeRecord = {
      id: createRecordId("adjustment"),
      kind: "adjustment",
      dateKey,
      calories: increaseCalories - decreaseCalories,
      increaseCalories,
      decreaseCalories,
      note: note.trim() || "热量校准",
      createdAt: Date.now()
    };

    await intakeRepository.add(record);
    records.value = [record, ...records.value];
  }

  async function clear() {
    await intakeRepository.clear();
    records.value = [];
  }

  async function remove(id: string) {
    await intakeRepository.remove(id);
    records.value = records.value.filter((record) => record.id !== id);
  }

  function recordsForDay(dateKey: string) {
    return recordsByDay.value.get(dateKey) ?? [];
  }

  return {
    records,
    ready,
    days,
    load,
    addFood,
    addAdjustment,
    clear,
    remove,
    recordsForDay
  };
});
