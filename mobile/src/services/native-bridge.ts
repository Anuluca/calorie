import { Capacitor, registerPlugin } from "@capacitor/core";

export type AppTheme = "system" | "light" | "dark";
export type NativeToastTone = "success" | "error" | "info";

type SystemBarsStyle = "LIGHT" | "DARK";

type SystemBarsPlugin = {
  setStyle(options: { style: SystemBarsStyle; bar?: string }): Promise<void>;
};

const SystemBars = registerPlugin<SystemBarsPlugin>("SystemBars");

type NativeBridgeMessage =
  | { type: "route"; path: string }
  | { type: "startup"; ready: boolean }
  | { type: "startupContentPainted" }
  | { type: "overlay"; visible: boolean }
  | { type: "theme"; theme: AppTheme }
  | {
      type: "confirm";
      action: string;
      title: string;
      message: string;
      confirmTitle: string;
    }
  | { type: "toast"; message: string; tone: NativeToastTone };

type NativeWindow = Window & {
  __iosNativeLiquidGlass?: boolean;
  AndroidStartupBridge?: {
    revealContent: () => void;
    setTheme: (theme: AppTheme) => void;
    showKeyboard: () => void;
  };
  webkit?: {
    messageHandlers?: {
      liquidGlassNavigation?: {
        postMessage: (message: NativeBridgeMessage) => void;
      };
    };
  };
};

function postNativeMessage(
  message: NativeBridgeMessage,
  requireReadyMarker = true
): boolean {
  const nativeWindow = window as NativeWindow;
  const handler = nativeWindow.webkit?.messageHandlers?.liquidGlassNavigation;
  if ((requireReadyMarker && !nativeWindow.__iosNativeLiquidGlass) || !handler) {
    return false;
  }
  handler.postMessage(message);
  return true;
}

/** 路由初始化可能早于 iOS 能力标记，因此只检测消息处理器。 */
export function syncNativeRoute(path: string): boolean {
  return postNativeMessage({ type: "route", path }, false);
}

/**
 * 通知 iOS 原生层开屏是否已结束。
 * 不依赖 ready 标记，确保页面刚开始执行脚本时即可隐藏原生菜单栏。
 */
export function setNativeStartupReady(ready: boolean): boolean {
  return postNativeMessage({ type: "startup", ready }, false);
}

/** 首页完成首帧绘制后，通知 iOS 原生开屏承接层淡出。 */
export function revealNativeStartupContent(): boolean {
  const nativeWindow = window as NativeWindow;
  if (nativeWindow.AndroidStartupBridge) {
    nativeWindow.AndroidStartupBridge.revealContent();
    return true;
  }
  return postNativeMessage({ type: "startupContentPainted" }, false);
}

export function setNativeOverlayVisible(visible: boolean) {
  postNativeMessage({ type: "overlay", visible });
}

export function syncNativeTheme(theme: AppTheme) {
  const nativeWindow = window as NativeWindow;
  if (Capacitor.getPlatform() === "android") {
    const style: SystemBarsStyle = theme === "dark"
      || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
      ? "DARK"
      : "LIGHT";

    // 先更新 Capacitor 内部保存的系统栏状态，完成后再同步窗口和 WebView 背景。
    void SystemBars.setStyle({ style })
      .catch(() => undefined)
      .finally(() => nativeWindow.AndroidStartupBridge?.setTheme(theme));
  } else {
    nativeWindow.AndroidStartupBridge?.setTheme(theme);
  }
  postNativeMessage({ type: "theme", theme });
}

/** DOM 聚焦后由 Android 原生层请求输入法，修复冷启动不弹软键盘。 */
export function showAndroidKeyboard(): boolean {
  const bridge = (window as NativeWindow).AndroidStartupBridge;
  if (!bridge) return false;
  bridge.showKeyboard();
  return true;
}

export function requestNativeConfirmation(options: {
  action: string;
  title: string;
  message: string;
  confirmTitle?: string;
}): boolean {
  return postNativeMessage({
    type: "confirm",
    action: options.action,
    title: options.title,
    message: options.message,
    confirmTitle: options.confirmTitle ?? "删除"
  });
}

export function showNativeToast(
  message: string,
  tone: NativeToastTone = "success"
): boolean {
  return postNativeMessage({ type: "toast", message, tone });
}
