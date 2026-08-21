<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { AppLauncher } from "@capacitor/app-launcher";
import { Capacitor } from "@capacitor/core";
import { IonContent, IonPage } from "@ionic/vue";
import { useHistoryStore } from "@/stores/history";

const history = useHistoryStore();
const clearing = ref(false);
const cleared = ref(false);

const hasCloudEndpoint = computed(() => {
  const endpoint = String(import.meta.env.VITE_API_BASE_URL ?? "");
  return Boolean(endpoint && !endpoint.includes("example.workers.dev"));
});

onMounted(() => history.load());

async function clearHistory() {
  if (!history.count || clearing.value) return;

  clearing.value = true;
  cleared.value = false;
  try {
    await history.clear();
    cleared.value = true;
  } finally {
    clearing.value = false;
  }
}

async function openDeveloperSite() {
  const url = "https://anuluca.com";
  if (Capacitor.isNativePlatform()) {
    await AppLauncher.openUrl({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
</script>

<template>
  <ion-page>
    <ion-content :fullscreen="true" class="app-content">
      <main class="page-shell">
        <header class="title-row">
          <h1>设置</h1>
        </header>

        <section class="history-settings" aria-labelledby="history-settings-title">
          <div>
            <h2 id="history-settings-title">历史记录</h2>
            <p>{{ history.count ? `当前保存了 ${history.count} 条记录。` : "当前没有历史记录。" }}</p>
          </div>
          <button
            type="button"
            class="danger-button"
            :disabled="!history.count || clearing"
            @click="clearHistory"
          >
            {{ clearing ? "清除中…" : "清除" }}
          </button>
        </section>

        <p v-if="cleared" class="clear-status" role="status">历史记录已全部清除。</p>

        <section class="settings-descriptions" aria-label="应用说明">
          <article>
            <h2>智能查询</h2>
            <p>
              {{ hasCloudEndpoint ? "云端查询服务已配置，可以分析食物与份量。" : "云端查询服务等待部署，部署后可分析食物与份量。" }}
            </p>
          </article>

          <article>
            <h2>查询方式</h2>
            <p>热量结果完全由 AI 根据食物名称、份量与常见烹饪方式估算。</p>
          </article>

          <article>
            <h2>数据存储</h2>
            <p>查询历史仅保存在当前设备，不会同步到其他设备。</p>
          </article>
        </section>

        <p class="legal-note">
          热量会受重量、配方和烹饪方式影响，结果仅供饮食记录参考。
        </p>

        <footer class="developer-info">
          <button
            type="button"
            class="developer-logo"
            aria-label="访问 Anuluca 网站"
            @click="openDeveloperSite"
          >
            <img src="/anuluca-logo.png" alt="Anuluca" />
          </button>
          <p>
            DEVELOPED &amp; DESIGNED BY<br />
            © 2026 Anuluca.
          </p>
        </footer>
      </main>
    </ion-content>
  </ion-page>
</template>
