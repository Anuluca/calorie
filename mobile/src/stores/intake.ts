import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { intakeRepository } from "@/services/intake-repository";
import { summarizeIntakeDays, toLocalDateKey } from "@/services/intake-domain";
import type { FoodQueryResult, IntakeRecord } from "@/types";

function createRecordId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useIntakeStore = defineStore("intake", () => {
  const records = ref<IntakeRecord[]>([]);
  const ready = ref(false);
  const days = computed(() => summarizeIntakeDays(records.value));

  async function load() {
    if (ready.value) return;
    records.value = await intakeRepository.list();
    ready.value = true;
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

    records.value = [record, ...records.value];
    await intakeRepository.add(record);
  }

  async function addAdjustment(dateKey: string, calories: number, note: string) {
    const record: IntakeRecord = {
      id: createRecordId("adjustment"),
      kind: "adjustment",
      dateKey,
      calories,
      note: note.trim() || "热量校准",
      createdAt: Date.now()
    };

    records.value = [record, ...records.value];
    await intakeRepository.add(record);
  }

  function recordsForDay(dateKey: string) {
    return records.value
      .filter((record) => record.dateKey === dateKey)
      .sort((left, right) => right.createdAt - left.createdAt);
  }

  return { records, ready, days, load, addFood, addAdjustment, recordsForDay };
});
