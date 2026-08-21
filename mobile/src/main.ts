import { createApp } from "vue";
import { createPinia } from "pinia";
import { IonicVue } from "@ionic/vue";
import App from "./App.vue";
import router from "./router";

import "@ionic/vue/css/core.css";
import "@ionic/vue/css/normalize.css";
import "@ionic/vue/css/structure.css";
import "@ionic/vue/css/typography.css";
import "@ionic/vue/css/padding.css";
import "@ionic/vue/css/display.css";
import "./theme.css";

const app = createApp(App);

app.use(IonicVue, { mode: "ios" });
app.use(createPinia());
app.use(router);

router.isReady().then(() => app.mount("#app"));

