import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { historyRepository } from "@/services/history-repository";
import type { FoodQueryResult } from "@/types";

export const useHistoryStore = defineStore("history", () => {
  const items = ref<FoodQueryResult[]>([]);
  const ready = ref(false);

  const count = computed(() => items.value.length);

  async function load() {
    if (ready.value) return;
    items.value = await historyRepository.list();
    ready.value = true;
  }

  async function add(item: FoodQueryResult) {
    items.value = [item, ...items.value.filter((value) => value.id !== item.id)];
    await historyRepository.add(item);
  }

  async function clear() {
    items.value = [];
    await historyRepository.clear();
  }

  async function remove(id: string) {
    items.value = items.value.filter((item) => item.id !== id);
    await historyRepository.remove(id);
  }

  return { items, count, ready, load, add, clear, remove };
});
