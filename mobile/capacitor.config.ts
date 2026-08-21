import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.anuluca.calorieai",
  appName: "热量快查",
  webDir: "dist",
  backgroundColor: "#f4f5f7",
  ios: {
    // 让 WebView 覆盖 Home Indicator 安全区，避免底部露出原生白色背景。
    contentInset: "never",
    preferredContentMode: "mobile"
  },
  android: {
    backgroundColor: "#f4f5f7",
    allowMixedContent: false
  }
};

export default config;
