<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { App as CapacitorApp } from "@capacitor/app";
import {
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
  IonToast
} from "@ionic/vue";
import { searchOutline, sparkles, timeOutline } from "ionicons/icons";
import { useRouter } from "vue-router";
import { queryFood } from "@/services/query-service";
import { compareCalories } from "@/services/calorie-comparison";
import { useHistoryStore } from "@/stores/history";
import { useIntakeStore } from "@/stores/intake";
import type { FoodQueryResult } from "@/types";
import ResultCard from "@/components/ResultCard.vue";

const history = useHistoryStore();
const intake = useIntakeStore();
const router = useRouter();
const queryInput = ref<HTMLTextAreaElement | null>(null);
const query = ref("");
const result = ref<FoodQueryResult | null>(null);
const previousResult = ref<FoodQueryResult | null>(null);
const loading = ref(false);
const error = ref("");
const recording = ref(false);
const recordToastOpen = ref(false);
let removeAppStateListener: (() => Promise<void>) | null = null;

const comparison = computed(() => {
  if (!previousResult.value || !result.value) return null;
  return compareCalories(previousResult.value.calories, result.value.calories);
});

function focusQuery() {
  void nextTick(() => {
    window.setTimeout(() => {
      queryInput.value?.focus({ preventScroll: true });
    }, 120);
  });
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") focusQuery();
}

onMounted(async () => {
  await Promise.all([history.load(), intake.load()]);
  focusQuery();

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", focusQuery);

  const listener = await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
    if (isActive) focusQuery();
  });
  removeAppStateListener = () => listener.remove();
});

async function recordLatestResult() {
  if (!result.value || recording.value) return;

  recording.value = true;
  try {
    await intake.addFood(result.value);
    recordToastOpen.value = true;
  } finally {
    recording.value = false;
  }
}

onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("focus", focusQuery);
  void removeAppStateListener?.();
});

async function submit(text = query.value) {
  // 提交后立即释放输入焦点，确保移动端软键盘收起。
  queryInput.value?.blur();

  const value = text.trim();
  if (!value || loading.value) return;

  query.value = value;
  loading.value = true;
  error.value = "";

  try {
    const nextResult = await queryFood(value);

    // 优先比较当前页面上一条结果；首次查询时使用本地最近一次历史记录。
    const comparisonBase = result.value ?? history.items[0] ?? null;
    previousResult.value =
      comparisonBase && comparisonBase.id !== nextResult.id ? comparisonBase : null;
    result.value = nextResult;
    await history.add(nextResult);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "查询失败";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <ion-page>
    <ion-content :fullscreen="true" class="app-content">
      <main class="page-shell search-page">
        <header class="page-header">
          <div class="app-mark" aria-hidden="true">
            <ion-icon :icon="sparkles" />
          </div>
          <h1>热量快查</h1>
          <button
            type="button"
            class="header-icon-button"
            aria-label="查看历史记录"
            @click="router.push('/history')"
          >
            <ion-icon :icon="timeOutline" aria-hidden="true" />
          </button>
        </header>

        <form class="search-panel" @submit.prevent="submit()">
          <label class="sr-only" for="food-query">食物名称和份量</label>
          <textarea
            id="food-query"
            ref="queryInput"
            v-model="query"
            rows="2"
            maxlength="200"
            enterkeyhint="search"
            placeholder="例如：两个水煮鸡蛋"
            @keydown.enter.exact.prevent="submit()"
          />
          <button
            class="submit-button"
            type="submit"
            :disabled="!query.trim() || loading"
            aria-label="查询热量"
          >
            <ion-spinner v-if="loading" name="crescent" />
            <ion-icon v-else :icon="searchOutline" aria-hidden="true" />
          </button>
        </form>

        <p v-if="error" class="error-message" role="alert">{{ error }}</p>

        <transition name="result">
          <section v-if="result" class="result-stack" aria-live="polite">
            <div
              v-if="previousResult && comparison"
              class="calorie-comparison"
              :aria-label="comparison.ariaLabel"
            >
              <div class="comparison-result">
                <span>上一条</span>
                <strong>{{ previousResult.name }}</strong>
                <p>{{ previousResult.calories }} 千卡</p>
              </div>

              <div class="comparison-operator" aria-hidden="true">
                <strong>{{ comparison.symbol }}</strong>
                <span>{{ comparison.summary }}</span>
              </div>

              <div class="comparison-result comparison-result-latest">
                <span>最新</span>
                <strong>{{ result.name }}</strong>
                <p>{{ result.calories }} 千卡</p>
              </div>
            </div>

            <result-card
              :result="result"
              :recording="recording"
              @record="recordLatestResult"
            />
          </section>
        </transition>

        <div v-if="!result && !error" class="empty-state">
          <div class="empty-ring" aria-hidden="true">
            <span />
          </div>
          <p>输入食物和份量</p>
        </div>
      </main>
    </ion-content>
    <ion-toast
      :is-open="recordToastOpen"
      message="已记录"
      position="top"
      :duration="1400"
      @did-dismiss="recordToastOpen = false"
    />
  </ion-page>
</template>
