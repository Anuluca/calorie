import { createApp } from "vue";
import { createPinia } from "pinia";
import { Capacitor } from "@capacitor/core";
import { IonicVue } from "@ionic/vue";
import App from "./App.vue";
import router from "./router";
import { loadTheme } from "./services/theme";
import {
  revealNativeStartupContent,
  setNativeStartupReady,
} from "./services/native-bridge";
import { prewarmSpeechRecognition } from "./services/speech-recognition-prewarm";

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

// 尽早在后台检查语音能力与已有权限，不启用麦克风，也不阻塞应用首屏。
if (Capacitor.isNativePlatform()) {
  void prewarmSpeechRecognition().catch(() => undefined);
}

const app = createApp(App);

// WebView 重新加载时，原生控制器可能仍然存在，需先主动隐藏原生菜单栏。
setNativeStartupReady(false);

app.use(IonicVue, { mode: "ios" });
app.use(createPinia());
app.use(router);

function finishNativeStartup() {
  const root = document.documentElement;
  root.classList.remove("startup-splash-active");
  window.dispatchEvent(new Event("startup-splash-dismissed"));
}

window.addEventListener("native-startup-transition-complete", finishNativeStartup, {
  once: true
});

Promise.all([router.isReady(), loadTheme()]).then(() => {
  app.mount("#app");
  // 首页完成布局后，原生开屏承接层直接淡出到主页。
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    if (!revealNativeStartupContent()) {
      // Web 与 Android 没有 iOS 原生承接层，首页完成首帧后直接进入可交互状态。
      setNativeStartupReady(true);
      finishNativeStartup();
    }
  }));
});
