import { onBeforeUnmount, onMounted } from "vue";

const confirmationEventName = "native-liquid-glass-confirmation";

/**
 * 统一管理 iOS 原生确认框的事件生命周期，避免页面重复注册、解析和注销监听器。
 */
export function useNativeConfirmation(handler: (action: string) => void): void {
  function handleConfirmation(event: Event) {
    const action = (event as CustomEvent<{ action?: string }>).detail?.action;
    if (action) handler(action);
  }

  onMounted(() => window.addEventListener(confirmationEventName, handleConfirmation));
  onBeforeUnmount(() =>
    window.removeEventListener(confirmationEventName, handleConfirmation)
  );
}
