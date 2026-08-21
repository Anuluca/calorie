<script setup lang="ts">
import { computed, onMounted } from "vue";
import { IonContent, IonIcon, IonPage } from "@ionic/vue";
import {
  addCircleOutline,
  arrowBackOutline,
  removeCircleOutline,
  restaurantOutline
} from "ionicons/icons";
import { useRoute, useRouter } from "vue-router";
import { useIntakeStore } from "@/stores/intake";

const intake = useIntakeStore();
const route = useRoute();
const router = useRouter();
const dateKey = computed(() => String(route.params.dateKey));
const records = computed(() => intake.recordsForDay(dateKey.value));
const summary = computed(() =>
  intake.days.find((day) => day.dateKey === dateKey.value)
);

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long"
});
const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit"
});

onMounted(() => intake.load());

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00`));
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.replace("/tabs/records");
}
</script>

<template>
  <ion-page>
    <ion-content :fullscreen="true" class="app-content">
      <main class="page-shell record-detail-page">
        <header class="title-row record-detail-title-row">
          <button
            type="button"
            class="header-icon-button back-button"
            aria-label="返回记录"
            @click="goBack"
          >
            <ion-icon :icon="arrowBackOutline" aria-hidden="true" />
          </button>
          <div>
            <h1>{{ summary?.isToday ? "今天" : "每日详情" }}</h1>
            <p>{{ formatDate(dateKey) }}</p>
          </div>
          <span class="header-spacer" aria-hidden="true" />
        </header>

        <section v-if="summary" class="record-detail-total">
          <span>总摄入</span>
          <p><strong>{{ summary.totalCalories }}</strong><span>千卡</span></p>
          <small v-if="summary.adjustmentCalories">
            食物 {{ summary.foodCalories }} · 校准
            {{ summary.adjustmentCalories > 0 ? "+" : "" }}{{ summary.adjustmentCalories }}
          </small>
        </section>

        <section v-if="records.length" class="record-detail-list" aria-label="摄入明细">
          <article
            v-for="record in records"
            :key="record.id"
            class="record-detail-item"
            :class="{ 'record-detail-adjustment': record.kind === 'adjustment' }"
          >
            <div class="record-detail-icon" aria-hidden="true">
              <ion-icon
                :icon="record.kind === 'food'
                  ? restaurantOutline
                  : record.calories >= 0
                    ? addCircleOutline
                    : removeCircleOutline"
              />
            </div>
            <div class="record-detail-copy">
              <strong>{{ record.kind === "food" ? record.name : "热量校准" }}</strong>
              <p>{{ record.kind === "food" ? record.quantityText : record.note }}</p>
              <span>{{ timeFormatter.format(record.createdAt) }}</span>
            </div>
            <p class="record-detail-calories">
              <strong>{{ record.kind === "adjustment" && record.calories > 0 ? "+" : "" }}{{ record.calories }}</strong>
              <span>千卡</span>
            </p>
          </article>
        </section>
      </main>
    </ion-content>
  </ion-page>
</template>
