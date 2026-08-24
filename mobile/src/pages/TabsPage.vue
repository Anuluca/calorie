<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
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
const router = useRouter();
const tabs = ["search", "records", "settings"];
const activeIndex = computed(() => {
  const segments = route.path.split("/");
  const currentTab = String(segments[segments.length - 1]);
  return Math.max(0, tabs.indexOf(currentTab));
});

type ScrollableIonContent = HTMLElement & {
  scrollToTop: (duration?: number) => Promise<void>;
};

/**
 * Ionic 会缓存各个 Tab 页面，因此切换路由时原页面的滚动位置也会被保留。
 * 等目标页面完成激活后，定位当前可见页面的 ion-content 并立即回到顶部。
 */
async function scrollActiveTabToTop() {
  await nextTick();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const activePage = document.querySelector(
        ".tab-router-outlet > ion-page:not(.ion-page-hidden)"
      );
      const content = activePage?.querySelector<ScrollableIonContent>("ion-content");
      void content?.scrollToTop(0);
    });
  });
}

watch(
  () => route.path,
  (path, previousPath) => {
    if (path === previousPath || !tabs.some((tab) => path === `/tabs/${tab}`)) return;
    void scrollActiveTabToTop();
  },
  { flush: "post" }
);

function handleNativeTab(event: Event) {
  const tab = (event as CustomEvent<{ tab?: string }>).detail?.tab;
  if (!tab || !tabs.includes(tab)) return;
  void router.push(`/tabs/${tab}`);
}

onMounted(() => window.addEventListener("native-liquid-glass-tab", handleNativeTab));
onBeforeUnmount(() => window.removeEventListener("native-liquid-glass-tab", handleNativeTab));
</script>

<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet class="tab-router-outlet" :animated="false" />
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
