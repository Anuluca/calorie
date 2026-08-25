import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.anuluca.calorieai",
  appName: "热量快查",
  webDir: "dist",
  // 原生容器到 WebView 首帧之间始终使用开屏暗色，避免浅色主题冷启动时白闪。
  backgroundColor: "#080a0d",
  ios: {
    // 让 WebView 覆盖 Home Indicator 安全区，避免底部露出原生白色背景。
    contentInset: "never",
    preferredContentMode: "mobile"
  },
  android: {
    // 与浅色主题 --app-bg 一致，避免透明系统栏与 WebView 出现色差。
    backgroundColor: "#f3f4f6",
    allowMixedContent: false
  }
};

export default config;
