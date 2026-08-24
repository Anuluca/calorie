<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import {
  IonAlert,
  IonContent,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonPage
} from "@ionic/vue";
import {
  addCircleOutline,
  arrowBackOutline,
  removeCircleOutline,
  restaurantOutline,
  trashOutline
} from "ionicons/icons";
import { useRoute, useRouter } from "vue-router";
import { useIntakeStore } from "@/stores/intake";
import { requestNativeConfirmation } from "@/services/native-bridge";

const intake = useIntakeStore();
const route = useRoute();
const router = useRouter();
const dateKey = computed(() => String(route.params.dateKey));
const records = computed(() => intake.recordsForDay(dateKey.value));
const summary = computed(() =>
  intake.days.find((day) => day.dateKey === dateKey.value)
);
const deleteAlertOpen = ref(false);
const pendingDeleteId = ref("");

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

function handleNativeConfirmation(event: Event) {
  const action = (event as CustomEvent<{ action?: string }>).detail?.action ?? "";
  if (action.startsWith("delete-intake:")) {
    void removeRecord(action.slice("delete-intake:".length));
  }
}

onMounted(() => {
  void intake.load();
  window.addEventListener("native-liquid-glass-confirmation", handleNativeConfirmation);
});

onBeforeUnmount(() => {
  window.removeEventListener("native-liquid-glass-confirmation", handleNativeConfirmation);
});

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

function adjustmentBreakdown(record: { calories: number; increaseCalories?: number; decreaseCalories?: number }) {
  const increase = record.increaseCalories ?? Math.max(record.calories, 0);
  const decrease = record.decreaseCalories ?? Math.max(-record.calories, 0);
  return `增加 ${increase} · 减少 ${decrease}`;
}

async function removeRecord(id: string) {
  await intake.remove(id);
  if (!intake.recordsForDay(dateKey.value).length) {
    await router.replace("/tabs/records");
  }
}

function requestRemoveRecord(id: string) {
  const handledNatively = requestNativeConfirmation({
    action: `delete-intake:${id}`,
    title: "删除这条记录？",
    message: "删除后将重新计算当天总热量，且无法恢复。"
  });
  if (handledNatively) return;
  pendingDeleteId.value = id;
  deleteAlertOpen.value = true;
}

async function removePendingRecord() {
  if (!pendingDeleteId.value) return;
  await removeRecord(pendingDeleteId.value);
  pendingDeleteId.value = "";
}

const deleteButtons = [
  { text: "取消", role: "cancel" },
  { text: "删除", role: "destructive", handler: () => void removePendingRecord() }
];
</script>

<template>
  <ion-page>
    <ion-content :fullscreen="true" class="app-content">
      <main class="page-shell record-detail-page">
        <header class="title-row record-detail-title-row">
          <button
            type="button"
            class="header-icon-button back-button native-glass-back-fallback"
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
          <p><strong>{{ summary.totalCalories }}</strong><span>大卡</span></p>
          <small v-if="summary.adjustmentCalories">
            食物 {{ summary.foodCalories }} · 校准
            {{ summary.adjustmentCalories > 0 ? "+" : "" }}{{ summary.adjustmentCalories }}
          </small>
        </section>

        <section v-if="records.length" class="record-detail-list" aria-label="摄入明细">
          <ion-item-sliding
            v-for="record in records"
            :key="record.id"
            class="record-detail-sliding-item"
          >
            <ion-item lines="none" class="record-detail-slide-content">
              <article
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
                  <strong>{{ record.kind === "food" ? record.name : record.note }}</strong>
                  <p>{{ record.kind === "food" ? record.quantityText : "热量校准" }}</p>
                  <span>
                    {{ record.kind === "adjustment" ? `${adjustmentBreakdown(record)} · ` : "" }}{{ timeFormatter.format(record.createdAt) }}
                  </span>
                </div>
                <p class="record-detail-calories">
                  <strong>{{ record.kind === "adjustment" && record.calories > 0 ? "+" : "" }}{{ record.calories }}</strong>
                  <span>大卡</span>
                </p>
              </article>
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option color="danger" @click="requestRemoveRecord(record.id)">
                <ion-icon slot="start" :icon="trashOutline" aria-hidden="true" />
                删除
              </ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </section>
      </main>
    </ion-content>

    <ion-alert
      class="app-confirm-alert"
      :is-open="deleteAlertOpen"
      header="删除这条记录？"
      message="删除后将重新计算当天总热量，且无法恢复。"
      :buttons="deleteButtons"
      @did-dismiss="deleteAlertOpen = false"
    />
  </ion-page>
</template>
