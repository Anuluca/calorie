<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { AppLauncher } from "@capacitor/app-launcher";
import { Capacitor } from "@capacitor/core";
import { IonAlert, IonContent, IonIcon, IonModal, IonPage, IonToast } from "@ionic/vue";
import {
  bugOutline,
  chevronForwardOutline,
  documentTextOutline,
  informationCircleOutline,
  moonOutline,
  sunnyOutline
} from "ionicons/icons";
import { useRouter } from "vue-router";
import { sendFeedback } from "@/services/feedback-service";
import {
  requestNativeConfirmation,
  setNativeOverlayVisible,
  showNativeToast
} from "@/services/native-bridge";
import { loadTheme, saveTheme, type AppTheme } from "@/services/theme";
import { useHistoryStore } from "@/stores/history";
import { useIntakeStore } from "@/stores/intake";

const history = useHistoryStore();
const intake = useIntakeStore();
const router = useRouter();
const clearing = ref(false);
const cleared = ref(false);
const clearCacheAlertOpen = ref(false);
const theme = ref<AppTheme>("system");
const feedbackOpen = ref(false);
const feedbackTitle = ref("");
const feedbackContent = ref("");
const feedbackSending = ref(false);
const feedbackError = ref("");
const feedbackToastOpen = ref(false);

const themeOptions: { value: AppTheme; label: string }[] = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" }
];

const cacheCount = computed(() => history.count + intake.records.length);
const cacheSize = computed(() => {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ history: history.items, intake: intake.records })
  ).byteLength;
  const formatter = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
  if (bytes < 1024 * 1024) return `${formatter.format(bytes / 1024)}KB`;
  return `${formatter.format(bytes / 1024 / 1024)}MB`;
});

onMounted(async () => {
  window.addEventListener("native-liquid-glass-confirmation", handleNativeConfirmation);
  const [, , savedTheme] = await Promise.all([history.load(), intake.load(), loadTheme()]);
  theme.value = savedTheme;
});

onBeforeUnmount(() => {
  window.removeEventListener("native-liquid-glass-confirmation", handleNativeConfirmation);
});

function handleNativeConfirmation(event: Event) {
  const action = (event as CustomEvent<{ action?: string }>).detail?.action;
  if (action === "clear-cache") void clearCache();
}

function requestClearCache() {
  if (!cacheCount.value || clearing.value) return;
  const handledNatively = requestNativeConfirmation({
    action: "clear-cache",
    title: "清除所有数据？",
    message: "查询历史、摄入记录和热量校准记录将被永久删除。",
    confirmTitle: "清除"
  });
  if (!handledNatively) clearCacheAlertOpen.value = true;
}

async function clearCache() {
  if (!cacheCount.value || clearing.value) return;

  clearing.value = true;
  cleared.value = false;
  try {
    await Promise.all([history.clear(), intake.clear()]);
    cleared.value = true;
  } finally {
    clearing.value = false;
  }
}

const clearCacheButtons = [
  { text: "取消", role: "cancel" },
  { text: "清除", role: "destructive", handler: () => void clearCache() }
];

async function changeTheme(value: AppTheme) {
  theme.value = value;
  await saveTheme(value);
}

function openFeedback() {
  feedbackTitle.value = "";
  feedbackContent.value = "";
  feedbackError.value = "";
  feedbackOpen.value = true;
}

async function submitFeedback() {
  if (!feedbackTitle.value.trim() || !feedbackContent.value.trim() || feedbackSending.value) {
    return;
  }

  feedbackSending.value = true;
  feedbackError.value = "";
  try {
    await sendFeedback(feedbackTitle.value, feedbackContent.value);
    feedbackOpen.value = false;
    if (!showNativeToast("反馈已发送")) feedbackToastOpen.value = true;
  } catch (cause) {
    feedbackError.value = cause instanceof Error ? cause.message : "反馈发送失败";
  } finally {
    feedbackSending.value = false;
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

        <section class="history-settings" aria-labelledby="cache-settings-title">
          <div>
            <h2 id="cache-settings-title">数据存储</h2>
            <p>{{ cacheCount }}条记录 / {{ cacheSize }}</p>
          </div>
          <button
            type="button"
            class="danger-button"
            :disabled="!cacheCount || clearing"
            @click="requestClearCache"
          >
            {{ clearing ? "清除中…" : "清除" }}
          </button>
        </section>

        <p v-if="cleared" class="clear-status" role="status">数据已清除。</p>

        <section class="settings-actions" aria-label="应用功能">
          <div class="settings-action-row settings-theme-row">
            <div class="settings-action-copy">
              <span class="settings-action-icon" aria-hidden="true">
                <ion-icon :icon="theme === 'dark' ? moonOutline : sunnyOutline" />
              </span>
              <div>
                <h2>主题</h2>
                <p>选择应用的显示外观</p>
              </div>
            </div>
            <div class="theme-selector" aria-label="主题模式">
              <button
                v-for="option in themeOptions"
                :key="option.value"
                type="button"
                :class="{ selected: theme === option.value }"
                @click="changeTheme(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <button type="button" class="settings-action-row" @click="openFeedback">
            <span class="settings-action-copy">
              <span class="settings-action-icon" aria-hidden="true">
                <ion-icon :icon="bugOutline" />
              </span>
              <span>
                <strong>意见反馈</strong>
                <small>任何建议或者bug都可以提</small>
              </span>
            </span>
            <ion-icon :icon="chevronForwardOutline" aria-hidden="true" />
          </button>

          <button type="button" class="settings-action-row" @click="router.push('/updates')">
            <span class="settings-action-copy">
              <span class="settings-action-icon" aria-hidden="true">
                <ion-icon :icon="documentTextOutline" />
              </span>
              <span>
                <strong>更新记录</strong>
                <small>查看版本更新内容</small>
              </span>
            </span>
            <ion-icon :icon="chevronForwardOutline" aria-hidden="true" />
          </button>
        </section>

        <section class="settings-information" aria-label="查询与数据说明">
          <article class="settings-information-row">
            <h2>查询方式</h2>
            <p>热量结果完全由 AI 根据食物名称、份量与常见烹饪方式估算。</p>
          </article>

          <article class="settings-information-row">
            <h2>数据存储</h2>
            <p>查询历史与摄入记录仅保存在当前设备，不会同步到其他设备。</p>
          </article>

          <p class="settings-disclaimer">
            <ion-icon :icon="informationCircleOutline" aria-hidden="true" />
            <span>AI 估算会受重量、配方和烹饪方式影响，结果仅供饮食记录参考。</span>
          </p>
        </section>

        <footer class="developer-info">
          <div class="developer-logo" aria-hidden="true">
            <picture>
              <img class="theme-logo theme-logo-light" src="/calorie-ai-logo-light.png" alt="Calorie AI" />
              <img class="theme-logo theme-logo-dark" src="/calorie-ai-logo-dark.png" alt="" />
            </picture>
          </div>
          <button
            type="button"
            class="developer-credit-link"
            aria-label="访问 Anuluca 网站"
            @click="openDeveloperSite"
          >
            DEVELOPED &amp; DESIGNED BY<br />
            © 2026 Anuluca.
          </button>
        </footer>
      </main>
    </ion-content>

    <ion-alert
      class="app-confirm-alert"
      :is-open="clearCacheAlertOpen"
      header="清除所有数据？"
      message="查询历史、摄入记录和热量校准记录将被永久删除。"
      :buttons="clearCacheButtons"
      @did-dismiss="clearCacheAlertOpen = false"
    />

    <ion-modal
      class="feedback-modal"
      :is-open="feedbackOpen"
      :initial-breakpoint="0.68"
      :breakpoints="[0, 0.68]"
      @will-present="setNativeOverlayVisible(true)"
      @will-dismiss="setNativeOverlayVisible(false)"
      @did-dismiss="feedbackOpen = false"
    >
      <section class="feedback-sheet">
        <header>
          <div>
            <h2>意见反馈</h2>
            <p>反馈将发送至开发者邮箱tilucario@outlook.com</p>
          </div>
          <button type="button" class="feedback-close-button" @click="feedbackOpen = false">
            完成
          </button>
        </header>

        <label class="feedback-field">
          <span>标题</span>
          <input v-model="feedbackTitle" maxlength="100" placeholder="简要描述问题" />
        </label>
        <label class="feedback-field">
          <span>内容</span>
          <textarea
            v-model="feedbackContent"
            maxlength="2000"
            rows="6"
            placeholder="请描述出现问题的步骤和现象"
          />
        </label>
        <p v-if="feedbackError" class="feedback-error" role="alert">{{ feedbackError }}</p>
        <button
          type="button"
          class="feedback-send-button"
          :disabled="!feedbackTitle.trim() || !feedbackContent.trim() || feedbackSending"
          @click="submitFeedback"
        >
          {{ feedbackSending ? "发送中…" : "发送" }}
        </button>
      </section>
    </ion-modal>

    <ion-toast
      :is-open="feedbackToastOpen"
      message="反馈已发送"
      position="top"
      :duration="1400"
      @did-dismiss="feedbackToastOpen = false"
    />
  </ion-page>
</template>
