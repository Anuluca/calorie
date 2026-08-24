type NativeRouteWindow = Window & {
  webkit?: {
    messageHandlers?: {
      liquidGlassNavigation?: {
        postMessage: (message: { type: "route"; path: string }) => void;
      };
    };
  };
};

/** 路由初始化早于 iOS 能力标记，因此这里直接检测消息处理器。 */
export function syncNativeRoute(path: string) {
  const nativeWindow = window as NativeRouteWindow;
  nativeWindow.webkit?.messageHandlers?.liquidGlassNavigation?.postMessage({
    type: "route",
    path
  });
}
