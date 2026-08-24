<script setup lang="ts">
import { IonContent, IonIcon, IonPage } from "@ionic/vue";
import { arrowBackOutline } from "ionicons/icons";
import { useRouter } from "vue-router";
import { navigateBack } from "@/services/navigation";

const router = useRouter();

function goBack() {
  navigateBack(router, "/tabs/settings");
}
</script>

<template>
  <ion-page>
    <ion-content :fullscreen="true" class="app-content">
      <main class="page-shell updates-page">
        <header class="title-row updates-title-row">
          <button
            type="button"
            class="header-icon-button back-button native-glass-back-fallback"
            aria-label="返回设置"
            @click="goBack"
          >
            <ion-icon :icon="arrowBackOutline" aria-hidden="true" />
          </button>
          <h1>更新记录</h1>
          <span class="header-spacer" aria-hidden="true" />
        </header>

        <article class="update-card">
          <header>
            <strong>v1.0</strong>
            <time datetime="2026-09-12">2026/09/12</time>
          </header>
          <p>项目上线</p>
        </article>
      </main>
    </ion-content>
  </ion-page>
</template>
