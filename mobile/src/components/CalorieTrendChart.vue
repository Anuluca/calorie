<script setup lang="ts">
import { computed, ref } from "vue";
import type { IntakeDaySummary } from "@/types";

const props = defineProps<{
  days: IntakeDaySummary[];
}>();

const chartWidth = 320;
const chartHeight = 104;
const chartTop = 8;
const chartBottom = 92;
const selectedIndex = ref<number | null>(null);

function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

const trend = computed(() => {
  const totals = new Map(props.days.map((day) => [day.dateKey, day.totalCalories]));
  const today = new Date();

  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setHours(12, 0, 0, 0);
    date.setDate(today.getDate() - (29 - index));
    const dateKey = toDateKey(date);
    return {
      dateKey,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      calories: totals.get(dateKey) ?? 0
    };
  });
});

const maximum = computed(() => Math.max(...trend.value.map((item) => item.calories), 0));
const hasData = computed(() => maximum.value > 0);
const points = computed(() => {
  const scaleMaximum = Math.max(maximum.value, 1);
  return trend.value.map((item, index) => {
    const x = (index / (trend.value.length - 1)) * chartWidth;
    const ratio = Math.max(0, item.calories) / scaleMaximum;
    const y = chartBottom - ratio * (chartBottom - chartTop);
    return { ...item, x, y };
  });
});
const linePath = computed(() =>
  points.value.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ")
);
const areaPath = computed(() =>
  `${linePath.value} L ${chartWidth} ${chartBottom} L 0 ${chartBottom} Z`
);
const axisLabels = computed(() => [
  trend.value[0],
  trend.value[Math.floor((trend.value.length - 1) / 2)],
  { ...trend.value[trend.value.length - 1]!, label: "今天" }
]);
const selectedPoint = computed(() =>
  selectedIndex.value === null ? null : points.value[selectedIndex.value] ?? null
);
const tooltipX = computed(() => {
  if (!selectedPoint.value) return 0;
  return Math.min(chartWidth - 34, Math.max(34, selectedPoint.value.x));
});

function selectPoint(event: PointerEvent) {
  const bounds = (event.currentTarget as SVGSVGElement).getBoundingClientRect();
  if (!bounds.width) return;
  const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
  selectedIndex.value = Math.round(ratio * (points.value.length - 1));
}
</script>

<template>
  <section class="calorie-trend-card" aria-labelledby="calorie-trend-title">
    <header>
      <div>
        <h2 id="calorie-trend-title">近30天摄入热量</h2>
      </div>
      <strong v-if="hasData">峰值 {{ maximum }} 大卡</strong>
      <strong v-else>暂无数据</strong>
    </header>

    <div class="calorie-trend-plot">
      <svg
        :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
        role="img"
        :aria-label="hasData ? `近30天最高${maximum}大卡` : '近30天暂无热量数据'"
        preserveAspectRatio="none"
        @pointerdown="selectPoint"
      >
        <defs>
          <linearGradient id="calorie-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--accent)" stop-opacity="0.26" />
            <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
          </linearGradient>
        </defs>
        <line
          v-for="index in 3"
          :key="index"
          x1="0"
          :y1="chartTop + ((chartBottom - chartTop) / 3) * (index - 1)"
          :x2="chartWidth"
          :y2="chartTop + ((chartBottom - chartTop) / 3) * (index - 1)"
          class="calorie-trend-grid-line"
        />
        <path :d="areaPath" fill="url(#calorie-trend-fill)" />
        <path :d="linePath" class="calorie-trend-line" />
        <circle
          v-if="hasData"
          :cx="points[points.length - 1]?.x"
          :cy="points[points.length - 1]?.y"
          r="3.5"
          class="calorie-trend-current-point"
        />
        <g v-if="selectedPoint" class="calorie-trend-selection" aria-hidden="true">
          <line
            :x1="selectedPoint.x"
            :x2="selectedPoint.x"
            :y1="chartTop"
            :y2="chartBottom"
            class="calorie-trend-selection-line"
          />
          <circle
            :cx="selectedPoint.x"
            :cy="selectedPoint.y"
            r="4.5"
            class="calorie-trend-selected-point"
          />
          <rect :x="tooltipX - 31" y="0" width="62" height="20" rx="10" />
          <text :x="tooltipX" y="13.5">{{ selectedPoint.calories }} 大卡</text>
        </g>
      </svg>
      <div class="calorie-trend-axis" aria-hidden="true">
        <span v-for="item in axisLabels" :key="item?.dateKey">{{ item?.label }}</span>
      </div>
    </div>
  </section>
</template>
