<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
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
import { arrowBackOutline, timeOutline, trashOutline } from "ionicons/icons";
import { useRouter } from "vue-router";
import HistoryCard from "@/components/HistoryCard.vue";
import { useHistoryStore } from "@/stores/history";
import { requestNativeConfirmation } from "@/services/native-bridge";

const history = useHistoryStore();
const router = useRouter();
const clearAlertOpen = ref(false);
const deleteAlertOpen = ref(false);
const pendingDeleteId = ref("");

function handleNativeConfirmation(event: Event) {
  const action = (event as CustomEvent<{ action?: string }>).detail?.action ?? "";
  if (action === "clear-history") {
    void history.clear();
  } else if (action.startsWith("delete-history:")) {
    void history.remove(action.slice("delete-history:".length));
  }
}

onMounted(() => {
  void history.load();
  window.addEventListener("native-liquid-glass-confirmation", handleNativeConfirmation);
});

onBeforeUnmount(() => {
  window.removeEventListener("native-liquid-glass-confirmation", handleNativeConfirmation);
});

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.replace("/tabs/search");
}

function requestClearHistory() {
  if (!history.count) return;
  const handledNatively = requestNativeConfirmation({
    action: "clear-history",
    title: "清空查询历史？",
    message: "所有查询历史将被永久删除。",
    confirmTitle: "清空"
  });
  if (!handledNatively) clearAlertOpen.value = true;
}

function requestDeleteHistory(id: string) {
  const handledNatively = requestNativeConfirmation({
    action: `delete-history:${id}`,
    title: "删除这条历史？",
    message: "删除后无法恢复。"
  });
  if (handledNatively) return;
  pendingDeleteId.value = id;
  deleteAlertOpen.value = true;
}

async function deletePendingHistory() {
  if (!pendingDeleteId.value) return;
  await history.remove(pendingDeleteId.value);
  pendingDeleteId.value = "";
}

const clearButtons = [
  { text: "取消", role: "cancel" },
  { text: "清空", role: "destructive", handler: () => void history.clear() }
];
const deleteButtons = [
  { text: "取消", role: "cancel" },
  { text: "删除", role: "destructive", handler: () => void deletePendingHistory() }
];
</script>

<template>
  <ion-page>
    <ion-content :fullscreen="true" class="app-content">
      <main class="page-shell">
        <header class="title-row history-title-row">
          <button
            type="button"
            class="header-icon-button back-button native-glass-back-fallback"
            aria-label="返回查询"
            @click="goBack"
          >
            <ion-icon :icon="arrowBackOutline" aria-hidden="true" />
          </button>
          <h1>历史</h1>
          <button
            type="button"
            class="header-icon-button history-clear-button"
            aria-label="清空查询历史"
            :disabled="!history.count"
            @click="requestClearHistory"
          >
            <ion-icon :icon="trashOutline" aria-hidden="true" />
          </button>
        </header>

        <div v-if="history.count" class="history-list">
          <ion-item-sliding
            v-for="item in history.items"
            :key="item.id"
            class="history-sliding-item"
          >
            <ion-item lines="none" class="history-slide-content">
              <history-card :item="item" />
            </ion-item>
            <ion-item-options side="end">
              <ion-item-option
                color="danger"
                @click="requestDeleteHistory(item.id)"
              >
                <ion-icon slot="start" :icon="trashOutline" aria-hidden="true" />
                删除
              </ion-item-option>
            </ion-item-options>
          </ion-item-sliding>
        </div>

        <div v-else class="empty-state history-empty">
          <div class="empty-icon" aria-hidden="true">
            <ion-icon :icon="timeOutline" />
          </div>
          <p>还没有记录</p>
        </div>
      </main>
    </ion-content>

    <ion-alert
      class="app-confirm-alert"
      :is-open="clearAlertOpen"
      header="清空查询历史？"
      message="所有查询历史将被永久删除。"
      :buttons="clearButtons"
      @did-dismiss="clearAlertOpen = false"
    />
    <ion-alert
      class="app-confirm-alert"
      :is-open="deleteAlertOpen"
      header="删除这条历史？"
      message="删除后无法恢复。"
      :buttons="deleteButtons"
      @did-dismiss="deleteAlertOpen = false"
    />
  </ion-page>
</template>
