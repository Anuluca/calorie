import { createApp } from "vue";
import { createPinia } from "pinia";
import { Capacitor } from "@capacitor/core";
import { IonicVue } from "@ionic/vue";
import App from "./App.vue";
import router from "./router";
import { loadTheme } from "./services/theme";

import "@ionic/vue/css/core.css";
import "@ionic/vue/css/normalize.css";
import "@ionic/vue/css/structure.css";
import "@ionic/vue/css/typography.css";
import "@ionic/vue/css/padding.css";
import "@ionic/vue/css/display.css";
import "./theme.css";

// Android 原生端单独保留更大的底部触控间距。
if (Capacitor.getPlatform() === "android") {
  document.documentElement.classList.add("android-native");
}

const app = createApp(App);

app.use(IonicVue, { mode: "ios" });
app.use(createPinia());
app.use(router);

/**
 * 开屏仅随 WebView 首次加载执行。应用从后台恢复时页面不会重载，因此不会重复出现。
 * 先保证 Logo 至少完整展示 500ms，再让开屏和应用内容交叉淡入淡出。
 */
function dismissStartupSplash() {
  const root = document.documentElement;
  const startedAt = Number(root.dataset.splashStartedAt) || performance.now();
  const remainingTime = Math.max(0, 500 - (performance.now() - startedAt));

  window.setTimeout(() => {
    window.requestAnimationFrame(() => {
      root.classList.add("startup-splash-leaving");

      window.setTimeout(() => {
        document.querySelector("#startup-splash")?.remove();
        document.querySelector("#startup-splash-styles")?.remove();
        root.classList.remove("startup-splash-active", "startup-splash-leaving");
        delete root.dataset.splashStartedAt;
        // 查询页收到该事件后才允许自动聚焦，防止键盘出现在开屏之上。
        window.dispatchEvent(new Event("startup-splash-dismissed"));
      }, 300);
    });
  }, remainingTime);
}

Promise.all([router.isReady(), loadTheme()]).then(() => {
  app.mount("#app");
  // 等 Vue 和 Ionic 完成首帧布局后再开始切换，避免淡入空白页面。
  window.requestAnimationFrame(() => window.requestAnimationFrame(dismissStartupSplash));
});
