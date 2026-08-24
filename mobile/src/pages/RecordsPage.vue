<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  IonContent,
  IonAlert,
  IonButton,
  IonIcon,
  IonModal,
  IonPage,
  IonToast
} from "@ionic/vue";
import {
  addCircleOutline,
  optionsOutline,
  removeCircleOutline,
  restaurantOutline,
  trashOutline
} from "ionicons/icons";
import { useRouter } from "vue-router";
import { useIntakeStore } from "@/stores/intake";
import { setNativeOverlayVisible } from "@/services/native-bridge";
import CalorieTrendChart from "@/components/CalorieTrendChart.vue";
import { useNativeConfirmation } from "@/composables/use-native-confirmation";

const intake = useIntakeStore();
const router = useRouter();
const calibrationOpen = ref(false);
const calibrationIncrease = ref<number | null>(null);
const calibrationDecrease = ref<number | null>(null);
const calibrationNote = ref("");
const calibrationDateKey = ref("");
const savingCalibration = ref(false);
const calibrationToastOpen = ref(false);
const clearRecordsAlertOpen = ref(false);
const recordsClearedToastOpen = ref(false);

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "short"
});

const calibrationDateLabel = computed(() => {
  if (!calibrationDateKey.value) return "";
  return formatDate(calibrationDateKey.value);
});

const hasCalibrationValue = computed(() => {
  return Number(calibrationIncrease.value) > 0 || Number(calibrationDecrease.value) > 0;
});

const calibrationNet = computed(() => {
  return Math.round(Number(calibrationIncrease.value) || 0) -
    Math.round(Number(calibrationDecrease.value) || 0);
});

function handleNativeConfirmation(action: string) {
  if (action === "clear-records" && intake.records.length) void clearRecords();
}

onMounted(() => {
  void intake.load();
});
useNativeConfirmation(handleNativeConfirmation);

function formatDate(dateKey: string) {
  return dateFormatter.format(new Date(`${dateKey}T00:00:00`));
}

function foodPreview(names: string[]) {
  if (!names.length) return "仅包含热量校准";
  return names.join("、");
}

function openCalibration(dateKey: string) {
  calibrationDateKey.value = dateKey;
  calibrationIncrease.value = null;
  calibrationDecrease.value = null;
  calibrationNote.value = "";
  calibrationOpen.value = true;
}

async function saveCalibration() {
  const increase = Math.max(0, Math.round(Number(calibrationIncrease.value) || 0));
  const decrease = Math.max(0, Math.round(Number(calibrationDecrease.value) || 0));
  if (
    !calibrationDateKey.value ||
    (!increase && !decrease) ||
    savingCalibration.value
  ) return;

  savingCalibration.value = true;
  try {
    await intake.addAdjustment(
      calibrationDateKey.value,
      increase,
      decrease,
      calibrationNote.value
    );
    calibrationOpen.value = false;
    calibrationToastOpen.value = true;
  } finally {
    savingCalibration.value = false;
  }
}

async function clearRecords() {
  await intake.clear();
  recordsClearedToastOpen.value = true;
}

const clearRecordsButtons = [
  { text: "取消", role: "cancel" },
  {
    text: "清空",
    role: "destructive",
    handler: () => void clearRecords()
  }
];
</script>

<template>
  <ion-page>
    <ion-content :fullscreen="true" class="app-content">
      <main class="page-shell records-page">
        <header class="title-row records-title-row">
          <h1>记录</h1>
          <button
            type="button"
            class="header-icon-button records-clear-button"
            aria-label="清空记录"
            :disabled="!intake.records.length"
            @click="clearRecordsAlertOpen = true"
          >
            <ion-icon :icon="trashOutline" aria-hidden="true" />
          </button>
        </header>

        <calorie-trend-chart :days="intake.days" />

        <div v-if="intake.days.length" class="record-day-list">
          <article
            v-for="day in intake.days"
            :key="day.dateKey"
            class="record-day-card"
            :class="{ 'record-day-card-today': day.isToday }"
          >
            <button
              type="button"
              class="record-day-open-button"
              :aria-label="`查看${day.isToday ? '今天' : formatDate(day.dateKey)}记录详情`"
              @click="router.push(`/records/${day.dateKey}`)"
            ></button>
            <div class="record-day-topline">
              <div>
                <strong>{{ day.isToday ? "今天" : formatDate(day.dateKey) }}</strong>
                <span v-if="day.isToday">{{ formatDate(day.dateKey) }}</span>
              </div>
              <p><strong>{{ day.totalCalories }}</strong><span>大卡</span></p>
            </div>
            <div class="record-day-meta-row">
              <div class="record-day-meta-copy">
                <p class="record-food-preview">{{ foodPreview(day.foodNames) }}</p>
                <span v-if="day.adjustmentCalories" class="record-adjustment-summary">
                  含校准 {{ day.adjustmentCalories > 0 ? "+" : "" }}{{ day.adjustmentCalories }} 大卡
                </span>
              </div>
              <ion-button
                fill="clear"
                size="small"
                class="native-glass-button record-day-calibration-button"
                :aria-label="`校准${day.isToday ? '今天' : formatDate(day.dateKey)}热量`"
                @click="openCalibration(day.dateKey)"
              >
                <ion-icon slot="start" :icon="optionsOutline" aria-hidden="true" />
                校准
              </ion-button>
            </div>
          </article>
          <p class="records-retention-note">仅显示近60天数据</p>
        </div>

        <div v-else class="empty-state records-empty">
          <div class="empty-icon" aria-hidden="true">
            <ion-icon :icon="restaurantOutline" />
          </div>
          <p>还没有记录日</p>
        </div>
      </main>
    </ion-content>

    <ion-alert
      class="app-confirm-alert"
      :is-open="clearRecordsAlertOpen"
      header="清空所有记录？"
      message="摄入和热量校准记录将被永久删除。"
      :buttons="clearRecordsButtons"
      @did-dismiss="clearRecordsAlertOpen = false"
    />

    <ion-modal
      class="calibration-modal"
      :is-open="calibrationOpen"
      :initial-breakpoint="0.49"
      :breakpoints="[0, 0.49]"
      handle-behavior="cycle"
      @will-present="setNativeOverlayVisible(true)"
      @will-dismiss="setNativeOverlayVisible(false)"
      @did-dismiss="calibrationOpen = false"
    >
      <section class="calibration-sheet">
        <header>
          <div>
            <h2>热量校准</h2>
            <p>{{ calibrationDateLabel }}</p>
          </div>
          <button
            type="button"
            class="feedback-close-button"
            @click="calibrationOpen = false"
          >
            完成
          </button>
        </header>

        <div class="calibration-values" aria-label="校准数值">
          <label class="calibration-value-card calibration-value-increase">
            <span><ion-icon :icon="addCircleOutline" aria-hidden="true" />增加</span>
            <div>
              <input
                v-model.number="calibrationIncrease"
                type="number"
                min="0"
                inputmode="numeric"
                placeholder="0"
              />
              <span>大卡</span>
            </div>
          </label>
          <label class="calibration-value-card calibration-value-decrease">
            <span><ion-icon :icon="removeCircleOutline" aria-hidden="true" />减少</span>
            <div>
              <input
                v-model.number="calibrationDecrease"
                type="number"
                min="0"
                inputmode="numeric"
                placeholder="0"
              />
              <span>大卡</span>
            </div>
          </label>
        </div>

        <p class="calibration-net">
          本次净校准
          <strong>{{ calibrationNet > 0 ? "+" : "" }}{{ calibrationNet }} 大卡</strong>
        </p>

        <label class="calibration-field">
          <span>备注</span>
          <input
            v-model="calibrationNote"
            type="text"
            maxlength="80"
            placeholder="例如：公园跑步"
          />
        </label>

        <button
          type="button"
          class="calibration-save-button"
          :disabled="!hasCalibrationValue || savingCalibration"
          @click="saveCalibration"
        >
          {{ savingCalibration ? "保存中…" : "保存校准" }}
        </button>
      </section>
    </ion-modal>

    <ion-toast
      :is-open="calibrationToastOpen"
      message="校准已保存"
      position="top"
      :duration="1400"
      @did-dismiss="calibrationToastOpen = false"
    />
    <ion-toast
      :is-open="recordsClearedToastOpen"
      message="记录已清空"
      position="top"
      :duration="1400"
      @did-dismiss="recordsClearedToastOpen = false"
    />
  </ion-page>
</template>
