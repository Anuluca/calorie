<script setup lang="ts">
import { computed } from "vue";
import { addOutline, checkmarkCircle, informationCircle } from "ionicons/icons";
import { IonIcon } from "@ionic/vue";
import type { FoodQueryResult } from "@/types";

const props = withDefaults(
  defineProps<{ result: FoodQueryResult; recording?: boolean }>(),
  { recording: false }
);
const emit = defineEmits<{ record: [] }>();

const confidenceLabel = computed(() => {
  if (props.result.confidence === "high") return "可信度高";
  if (props.result.confidence === "medium") return "参考值";
  return "估算值";
});
</script>

<template>
  <article class="result-card" aria-live="polite">
    <div class="result-topline">
      <div>
        <h2>{{ result.name }}</h2>
        <p>{{ result.quantityText }} · 约 {{ result.grams }} 克</p>
      </div>
      <span class="confidence-pill">
        <ion-icon
          :icon="result.confidence === 'high' ? checkmarkCircle : informationCircle"
          aria-hidden="true"
        />
        {{ confidenceLabel }}
      </span>
    </div>

    <div class="energy-value">
      <strong>{{ result.calories }}</strong>
      <span>大卡</span>
    </div>

    <div class="result-footer">
      <div class="range-row">
        <span>可能范围</span>
        <strong>{{ result.calorieMin }}–{{ result.calorieMax }} 大卡</strong>
      </div>
      <button
        type="button"
        class="record-result-button"
        :disabled="recording"
        :aria-busy="recording"
        @click="emit('record')"
      >
        <ion-icon :icon="addOutline" aria-hidden="true" />
        记录
      </button>
    </div>
  </article>
</template>
