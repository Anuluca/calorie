<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  IonContent,
  IonIcon,
  IonModal,
  IonPage,
  IonToast
} from "@ionic/vue";
import { optionsOutline, restaurantOutline } from "ionicons/icons";
import { useRouter } from "vue-router";
import { useIntakeStore } from "@/stores/intake";

const intake = useIntakeStore();
const router = useRouter();
const calibrationOpen = ref(false);
const calibrationDirection = ref<"increase" | "decrease">("decrease");
const calibrationAmount = ref<number | null>(null);
const calibrationNote = ref("");
const calibrationDateKey = ref("");
const savingCalibration = ref(false);
const calibrationToastOpen = ref(false);

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "short"
});

const calibrationDateLabel = computed(() => {
  if (!calibrationDateKey.value) return "";
  const day = intake.days.find((item) => item.dateKey === calibrationDateKey.value);
  return day?.isToday ? "今天" : formatDate(calibrationDateKey.value);
});

onMounted(() => intake.load());

function formatDate(dateKey: string) {
  return dateFormatter.format(new Date(`${dateKey}T00:00:00`));
}

function foodPreview(names: string[]) {
  if (!names.length) return "仅包含热量校准";
  return names.join("、");
}

function openCalibration(dateKey: string) {
  calibrationDateKey.value = dateKey;
  calibrationDirection.value = "decrease";
  calibrationAmount.value = null;
  calibrationNote.value = "";
  calibrationOpen.value = true;
}

async function saveCalibration() {
  const amount = Number(calibrationAmount.value);
  if (
    !calibrationDateKey.value ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    savingCalibration.value
  ) return;

  savingCalibration.value = true;
  try {
    const signedCalories = calibrationDirection.value === "increase" ? amount : -amount;
    await intake.addAdjustment(
      calibrationDateKey.value,
      Math.round(signedCalories),
      calibrationNote.value
    );
    calibrationOpen.value = false;
    calibrationToastOpen.value = true;
  } finally {
    savingCalibration.value = false;
  }
}
</script>

<template>
  <ion-page>
    <ion-content :fullscreen="true" class="app-content">
      <main class="page-shell records-page">
        <header class="title-row records-title-row">
          <h1>记录</h1>
        </header>

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
              <p><strong>{{ day.totalCalories }}</strong><span>千卡</span></p>
            </div>
            <p class="record-food-preview">{{ foodPreview(day.foodNames) }}</p>
            <div class="record-day-footer">
              <span v-if="day.adjustmentCalories" class="record-adjustment-summary">
                含校准 {{ day.adjustmentCalories > 0 ? "+" : "" }}{{ day.adjustmentCalories }} 千卡
              </span>
              <button
                type="button"
                class="record-day-calibration-button"
                :aria-label="`校准${day.isToday ? '今天' : formatDate(day.dateKey)}热量`"
                @click="openCalibration(day.dateKey)"
              >
                <ion-icon :icon="optionsOutline" aria-hidden="true" />
                <span>校准</span>
              </button>
            </div>
          </article>
        </div>

        <div v-else class="empty-state records-empty">
          <div class="empty-icon" aria-hidden="true">
            <ion-icon :icon="restaurantOutline" />
          </div>
          <p>还没有摄入记录</p>
        </div>
      </main>
    </ion-content>

    <ion-modal
      class="calibration-modal"
      :is-open="calibrationOpen"
      :initial-breakpoint="0.62"
      :breakpoints="[0, 0.62]"
      handle-behavior="cycle"
      @did-dismiss="calibrationOpen = false"
    >
      <section class="calibration-sheet">
        <header>
          <div>
            <h2>{{ calibrationDateLabel }}热量校准</h2>
            <p>校准会单独保存，并只计入该日期的总热量。</p>
          </div>
          <button type="button" class="modal-close-button" @click="calibrationOpen = false">
            完成
          </button>
        </header>

        <div class="calibration-direction" role="group" aria-label="校准方向">
          <button
            type="button"
            :class="{ active: calibrationDirection === 'increase' }"
            @click="calibrationDirection = 'increase'"
          >
            增加
          </button>
          <button
            type="button"
            :class="{ active: calibrationDirection === 'decrease' }"
            @click="calibrationDirection = 'decrease'"
          >
            减少
          </button>
        </div>

        <label class="calibration-field">
          <span>热量</span>
          <div>
            <input
              v-model.number="calibrationAmount"
              type="number"
              min="1"
              inputmode="numeric"
              placeholder="例如 200"
            />
            <span>千卡</span>
          </div>
        </label>

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
          :disabled="!calibrationAmount || calibrationAmount <= 0 || savingCalibration"
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
  </ion-page>
</template>
