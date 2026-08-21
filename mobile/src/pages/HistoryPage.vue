<script setup lang="ts">
import { onMounted } from "vue";
import {
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

const history = useHistoryStore();
const router = useRouter();

onMounted(() => history.load());

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.replace("/tabs/search");
}
</script>

<template>
  <ion-page>
    <ion-content :fullscreen="true" class="app-content">
      <main class="page-shell">
        <header class="title-row history-title-row">
          <button
            type="button"
            class="header-icon-button back-button"
            aria-label="返回查询"
            @click="goBack"
          >
            <ion-icon :icon="arrowBackOutline" aria-hidden="true" />
          </button>
          <h1>历史</h1>
          <span class="header-spacer" aria-hidden="true" />
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
                @click="history.remove(item.id)"
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
  </ion-page>
</template>
