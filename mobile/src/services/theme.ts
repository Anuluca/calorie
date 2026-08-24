import { Preferences } from "@capacitor/preferences";
import { syncNativeTheme, type AppTheme } from "./native-bridge";

const themePreferenceKey = "app-theme-v1";
const themes: AppTheme[] = ["system", "light", "dark"];
let activeTheme: AppTheme = "system";
let themeLoaded = false;
let themeLoadPromise: Promise<AppTheme> | null = null;
let themeTransitionTimer: number | undefined;

export function applyTheme(theme: AppTheme) {
  activeTheme = theme;
  // 同步镜像到 localStorage，使下次冷启动能在异步原生 Preferences 返回前确定首帧主题。
  try {
    localStorage.setItem(themePreferenceKey, theme);
  } catch {
    // 隐私模式或存储受限时继续使用原生 Preferences，不阻断主题切换。
  }
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
  if (themeLoaded) return activeTheme;
  if (!themeLoadPromise) {
    themeLoadPromise = Preferences.get({ key: themePreferenceKey })
      .then(({ value }) => {
        const theme = themes.includes(value as AppTheme)
          ? (value as AppTheme)
          : "system";
        applyTheme(theme);
        themeLoaded = true;
        return theme;
      })
      .finally(() => {
        themeLoadPromise = null;
      });
  }
  return themeLoadPromise;
}

export async function saveTheme(theme: AppTheme) {
  themeLoaded = true;
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
