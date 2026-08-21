<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import {
  IonIcon,
  IonLabel,
  IonPage,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs
} from "@ionic/vue";
import { journalOutline, searchOutline, settingsOutline } from "ionicons/icons";

const route = useRoute();
const tabs = ["search", "records", "settings"];
const activeIndex = computed(() => {
  const segments = route.path.split("/");
  const currentTab = String(segments[segments.length - 1]);
  return Math.max(0, tabs.indexOf(currentTab));
});
</script>

<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet class="tab-router-outlet" />
      <ion-tab-bar slot="bottom" class="glass-tab-bar">
        <span
          class="tab-highlight"
          :style="{ transform: `translate3d(${activeIndex * 100}%, 0, 0)` }"
          aria-hidden="true"
        />
        <ion-tab-button tab="search" href="/tabs/search">
          <ion-icon :icon="searchOutline" aria-hidden="true" />
          <ion-label>查询</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="records" href="/tabs/records">
          <ion-icon :icon="journalOutline" aria-hidden="true" />
          <ion-label>记录</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="settings" href="/tabs/settings">
          <ion-icon :icon="settingsOutline" aria-hidden="true" />
          <ion-label>设置</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>
