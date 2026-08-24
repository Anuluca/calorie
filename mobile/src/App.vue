<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { App as CapacitorApp } from "@capacitor/app";
import { IonApp, IonRouterOutlet } from "@ionic/vue";
import { useRouter } from "vue-router";

const router = useRouter();
let removeAppStateListener: (() => Promise<void>) | null = null;

function openHistoryFromNativeButton() {
  if (router.currentRoute.value.path !== "/history") {
    void router.push("/history");
  }
}

function goBackFromNativeButton() {
  const path = router.currentRoute.value.path;
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.replace(path.startsWith("/records/") ? "/tabs/records" : "/tabs/search");
}

onMounted(async () => {
  window.addEventListener("native-liquid-glass-history", openHistoryFromNativeButton);
  window.addEventListener("native-liquid-glass-back", goBackFromNativeButton);

  const listener = await CapacitorApp.addListener("appStateChange", async ({ isActive }) => {
    if (!isActive) return;

    await router.replace("/tabs/search");
    window.dispatchEvent(new Event("app-resumed-to-search"));
  });
  removeAppStateListener = () => listener.remove();
});

onBeforeUnmount(() => {
  window.removeEventListener("native-liquid-glass-history", openHistoryFromNativeButton);
  window.removeEventListener("native-liquid-glass-back", goBackFromNativeButton);
  void removeAppStateListener?.();
});
</script>

<template>
  <ion-app>
    <ion-router-outlet :animated="true" />
  </ion-app>
</template>
