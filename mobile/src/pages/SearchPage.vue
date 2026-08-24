<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import {
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
  IonToast
} from "@ionic/vue";
import {
  fileTrayOutline,
  lockClosedOutline,
  lockOpenOutline,
  searchOutline,
  timeOutline
} from "ionicons/icons";
import { useRouter } from "vue-router";
import { AI_MODEL_DISPLAY_NAME, queryFood } from "@/services/query-service";
import {
  caloriesPer100Grams,
  compareCalories
} from "@/services/calorie-comparison";
import { useHistoryStore } from "@/stores/history";
import { useIntakeStore } from "@/stores/intake";
import { showNativeToast } from "@/services/native-bridge";
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
const comparisonMode = ref<"serving" | "weight">("serving");

const comparisonValues = computed(() => {
  if (!previousResult.value || !result.value) return null;
  if (comparisonMode.value === "weight") {
    return {
      previous: caloriesPer100Grams(
        previousResult.value.calories,
        previousResult.value.grams
      ),
      latest: caloriesPer100Grams(result.value.calories, result.value.grams)
    };
  }
  return {
    previous: previousResult.value.calories,
    latest: result.value.calories
  };
});
const comparison = computed(() => {
  if (!comparisonValues.value) return null;
  return compareCalories(
    comparisonValues.value.previous,
    comparisonValues.value.latest
  );
});
const comparisonLocked = computed(
  () => Boolean(previousResult.value?.id === history.lockedComparison?.id)
);

function focusQuery() {
  void nextTick(() => {
    window.setTimeout(() => {
      if (router.currentRoute.value.path !== "/tabs/search") return;
      const input = queryInput.value;
      input?.focus({ preventScroll: true });
      // 自动聚焦时若已有内容，直接全选，方便用户输入下一次查询。
      if (input?.value) input.select();
    }, 120);
  });
}

function focusQueryWhenReady() {
  if (document.documentElement.classList.contains("startup-splash-active")) {
    window.addEventListener("startup-splash-dismissed", focusQuery, { once: true });
    return;
  }
  focusQuery();
}

onMounted(async () => {
  await Promise.all([history.load(), intake.load()]);
  focusQueryWhenReady();

  window.addEventListener("app-resumed-to-search", focusQueryWhenReady);
});

async function recordLatestResult() {
  if (!result.value || recording.value) return;

  recording.value = true;
  try {
    await intake.addFood(result.value);
    if (!showNativeToast("已记录")) recordToastOpen.value = true;
  } finally {
    recording.value = false;
  }
}

async function toggleComparisonLock() {
  if (!previousResult.value) return;
  if (comparisonLocked.value) {
    await history.unlockComparison();
    return;
  }
  await history.lockComparison(previousResult.value);
}

onBeforeUnmount(() => {
  window.removeEventListener("startup-splash-dismissed", focusQuery);
  window.removeEventListener("app-resumed-to-search", focusQueryWhenReady);
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
    const comparisonBase =
      history.lockedComparison ?? result.value ?? history.items[0] ?? null;
    previousResult.value =
      comparisonBase && comparisonBase.id !== nextResult.id ? comparisonBase : null;
    result.value = nextResult;
    // 历史持久化失败不应覆盖已经成功返回的查询结果。
    try {
      await history.add(nextResult);
    } catch (historyError) {
      console.error("Failed to save query history", historyError);
    }
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
            <picture>
              <img class="theme-logo theme-logo-light" src="/calorie-ai-logo-light.png" alt="" />
              <img class="theme-logo theme-logo-dark" src="/calorie-ai-logo-dark.png" alt="" />
            </picture>
          </div>
          <h1>热量快查</h1>
          <button
            type="button"
            class="header-icon-button native-glass-history-fallback"
            aria-label="查看历史记录"
            @click="router.push('/history')"
          >
            <ion-icon :icon="timeOutline" aria-hidden="true" />
          </button>
        </header>

        <form
          class="search-panel"
          :class="{ 'search-panel-loading': loading }"
          :aria-busy="loading"
          @submit.prevent="submit()"
        >
          <label class="sr-only" for="food-query">食物名称和份量</label>
          <textarea
            id="food-query"
            ref="queryInput"
            v-model="query"
            rows="2"
            maxlength="200"
            enterkeyhint="search"
            placeholder="例如：炒饭"
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

        <transition
          name="result"
          mode="out-in"
          :duration="{ enter: 680, leave: 220 }"
        >
          <section
            v-if="result"
            :key="result.id"
            class="result-stack"
            aria-live="polite"
          >
            <result-card
              :result="result"
              :recording="recording"
              @record="recordLatestResult"
            />

            <div
              v-if="previousResult && comparison"
              class="calorie-comparison"
              :aria-label="`${comparisonMode === 'weight' ? '同等重量，每100克比较。' : '同为一份比较。'}${comparison.ariaLabel}`"
            >
              <div class="comparison-result">
                <span>{{ comparisonLocked ? "已锁定" : "上一条" }}</span>
                <div class="comparison-title-row">
                  <strong>{{ previousResult.name }}</strong>
                  <button
                    type="button"
                    class="comparison-lock-button"
                    :aria-label="comparisonLocked ? '取消锁定对比项' : '锁定当前对比项'"
                    :aria-pressed="comparisonLocked"
                    @click="toggleComparisonLock"
                  >
                    <ion-icon
                      :icon="comparisonLocked ? lockClosedOutline : lockOpenOutline"
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <small class="comparison-quantity">
                  {{ comparisonMode === "weight" ? "100克" : previousResult.quantityText }}
                </small>
                <p>{{ comparisonValues?.previous }} 大卡</p>
              </div>

              <div class="comparison-operator" aria-hidden="true">
                <strong>{{ comparison.symbol }}</strong>
                <span>{{ comparison.summary }}</span>
              </div>

              <div class="comparison-result comparison-result-latest">
                <span>最新</span>
                <strong>{{ result.name }}</strong>
                <small class="comparison-quantity">
                  {{ comparisonMode === "weight" ? "100克" : result.quantityText }}
                </small>
                <p>{{ comparisonValues?.latest }} 大卡</p>
              </div>

              <div class="comparison-mode-switch" role="group" aria-label="选择热量比较基准">
                <button
                  type="button"
                  :class="{ selected: comparisonMode === 'serving' }"
                  :aria-pressed="comparisonMode === 'serving'"
                  @click="comparisonMode = 'serving'"
                >
                  同为一份
                </button>
                <button
                  type="button"
                  :class="{ selected: comparisonMode === 'weight' }"
                  :aria-pressed="comparisonMode === 'weight'"
                  @click="comparisonMode = 'weight'"
                >
                  同等重量
                </button>
              </div>
            </div>
          </section>
        </transition>

        <div v-if="!result && !error" class="empty-state">
          <div class="empty-icon" aria-hidden="true">
            <ion-icon :icon="fileTrayOutline" />
          </div>
          <p>输入食物名称</p>
        </div>

        <p class="search-model-note">AI 模型：{{ AI_MODEL_DISPLAY_NAME }}</p>
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
