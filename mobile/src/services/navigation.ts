import type { RouteLocationRaw, Router } from "vue-router";

/** 在存在应用内历史时返回，否则进入调用方指定的安全页面。 */
export function navigateBack(router: Router, fallback: RouteLocationRaw): void {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.replace(fallback);
}
