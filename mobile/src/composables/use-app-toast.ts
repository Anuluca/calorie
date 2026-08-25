import { computed, ref } from "vue";
import { Capacitor } from "@capacitor/core";
import {
  alertCircleOutline,
  checkmarkCircle,
  informationCircleOutline
} from "ionicons/icons";
import {
  showNativeToast,
  type NativeToastTone
} from "@/services/native-bridge";

const androidToastIcons: Record<NativeToastTone, string> = {
  success: checkmarkCircle,
  error: alertCircleOutline,
  info: informationCircleOutline
};

/**
 * 统一原生与 Web Toast：iOS 26 优先使用系统玻璃提示，其余平台回退到 Ionic。
 * 页面只负责渲染一个 ion-toast，避免为成功、错误和状态消息维护重复状态。
 */
export function useAppToast() {
  const isOpen = ref(false);
  const message = ref("");
  const tone = ref<NativeToastTone>("info");
  const duration = ref(1400);
  const isAndroid = Capacitor.getPlatform() === "android";
  const icon = computed(() =>
    isAndroid ? androidToastIcons[tone.value] : undefined
  );

  function show(
    nextMessage: string,
    nextTone: NativeToastTone = "info",
    nextDuration = 1400
  ) {
    if (showNativeToast(nextMessage, nextTone)) {
      isOpen.value = false;
      return;
    }

    message.value = nextMessage;
    tone.value = nextTone;
    duration.value = nextDuration;
    isOpen.value = true;
  }

  function dismiss() {
    isOpen.value = false;
  }

  return { isOpen, message, icon, duration, show, dismiss };
}
