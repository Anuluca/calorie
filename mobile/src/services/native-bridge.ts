export type AppTheme = "system" | "light" | "dark";

type NativeBridgeMessage =
  | { type: "route"; path: string }
  | { type: "overlay"; visible: boolean }
  | { type: "theme"; theme: AppTheme }
  | {
      type: "confirm";
      action: string;
      title: string;
      message: string;
      confirmTitle: string;
    }
  | { type: "toast"; message: string };

type NativeWindow = Window & {
  __iosNativeLiquidGlass?: boolean;
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

export function setNativeOverlayVisible(visible: boolean) {
  postNativeMessage({ type: "overlay", visible });
}

export function syncNativeTheme(theme: AppTheme) {
  postNativeMessage({ type: "theme", theme });
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

export function showNativeToast(message: string): boolean {
  return postNativeMessage({ type: "toast", message });
}
