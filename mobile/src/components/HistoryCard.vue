<script setup lang="ts">
import type { FoodQueryResult } from "@/types";

defineProps<{ item: FoodQueryResult }>();

const formatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});
</script>

<template>
  <article class="history-card">
    <div>
      <h2>{{ item.name }}</h2>
      <p>{{ item.quantityText }} · {{ formatter.format(item.createdAt) }}</p>
    </div>
    <div class="history-energy">
      <strong>{{ item.calories }}</strong>
      <span>大卡</span>
    </div>
  </article>
</template>
