import { Preferences } from "@capacitor/preferences";
import { syncNativeTheme, type AppTheme } from "./native-bridge";

const themePreferenceKey = "app-theme-v1";
const themes: AppTheme[] = ["system", "light", "dark"];
let activeTheme: AppTheme = "system";
let themeTransitionTimer: number | undefined;

export function applyTheme(theme: AppTheme) {
  activeTheme = theme;
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = theme;
  }
  document.documentElement.style.colorScheme = theme === "system" ? "light dark" : theme;
  syncNativeTheme(theme);
}

window.addEventListener("ios-liquid-glass-ready", () => syncNativeTheme(activeTheme));

export async function loadTheme(): Promise<AppTheme> {
  const { value } = await Preferences.get({ key: themePreferenceKey });
  const theme = themes.includes(value as AppTheme) ? (value as AppTheme) : "system";
  applyTheme(theme);
  return theme;
}

export async function saveTheme(theme: AppTheme) {
  window.clearTimeout(themeTransitionTimer);
  document.documentElement.classList.add("theme-transitioning");
  // 先提交过渡样式，再切换变量，确保 WebView 能捕获两个主题状态。
  void document.documentElement.offsetWidth;
  applyTheme(theme);
  themeTransitionTimer = window.setTimeout(() => {
    document.documentElement.classList.remove("theme-transitioning");
  }, 360);
  await Preferences.set({ key: themePreferenceKey, value: theme });
}

export type { AppTheme } from "./native-bridge";
