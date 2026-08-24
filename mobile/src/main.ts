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

Promise.all([router.isReady(), loadTheme()]).then(() => app.mount("#app"));
