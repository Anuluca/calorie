package com.anuluca.calorieai;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.WebView;
import android.webkit.JavascriptInterface;

import androidx.appcompat.app.AppCompatDelegate;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.view.insets.ColorProtection;
import androidx.core.view.insets.ProtectionLayout;

import com.getcapacitor.BridgeActivity;

import java.util.Arrays;

public class MainActivity extends BridgeActivity {
    private static final String PREFERENCES_GROUP = "CapacitorStorage";
    private static final String THEME_KEY = "app-theme-v1";
    private volatile boolean keepSplashOnScreen = true;
    private ProtectionLayout systemBarProtection;
    private Boolean lightSystemBars;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 必须在 BridgeActivity 创建窗口前应用主题，避免浅色 App 先出现黑色原生窗口。
        SharedPreferences preferences = getSharedPreferences(PREFERENCES_GROUP, MODE_PRIVATE);
        String theme = preferences.getString(THEME_KEY, "system");

        if ("light".equals(theme)) {
            AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO);
        } else if ("dark".equals(theme)) {
            AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES);
        } else {
            AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM);
        }

        // 只保留 Android 原生 Splash，并持续覆盖到 Vue 首页真正完成首帧。
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        splashScreen.setKeepOnScreenCondition(() -> keepSplashOnScreen);
        splashScreen.setOnExitAnimationListener(provider ->
            provider.getView()
                .animate()
                .alpha(0f)
                .setDuration(300)
                .withEndAction(() -> {
                    provider.remove();
                    dispatchStartupTransitionComplete();
                })
                .start()
        );

        super.onCreate(savedInstanceState);
        // Android 15+ 已强制边到边；旧版本也使用相同布局，避免不同系统行为分叉。
        WindowCompat.enableEdgeToEdge(getWindow());
        installSystemBarProtection();
        bridge.getWebView().addJavascriptInterface(new StartupBridge(), "AndroidStartupBridge");
        applySystemBars(isLightTheme(this, theme));

        // 页面脚本异常时避免永久停留在启动画面。
        new Handler(Looper.getMainLooper()).postDelayed(() -> keepSplashOnScreen = false, 8000);
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        SharedPreferences preferences = getSharedPreferences(PREFERENCES_GROUP, MODE_PRIVATE);
        String theme = preferences.getString(THEME_KEY, "system");
        applySystemBars(isLightTheme(this, theme));
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // 部分厂商 ROM 会在窗口重新获得焦点时恢复黑色导航栏，必须再次同步。
        if (hasFocus && lightSystemBars != null) {
            applySystemBars(lightSystemBars);
        }
    }

    static boolean isLightTheme(Context context, String theme) {
        if ("light".equals(theme)) return true;
        if ("dark".equals(theme)) return false;
        int nightMode = context.getResources().getConfiguration().uiMode
            & Configuration.UI_MODE_NIGHT_MASK;
        return nightMode != Configuration.UI_MODE_NIGHT_YES;
    }

    private void installSystemBarProtection() {
        ViewGroup content = findViewById(android.R.id.content);
        if (content == null || content.getChildCount() == 0) return;

        // BridgeActivity 固定加载 Capacitor 自带布局；运行时重挂载才能包住真实 WebView。
        View capacitorLayout = content.getChildAt(0);
        content.removeView(capacitorLayout);
        systemBarProtection = new ProtectionLayout(this);
        systemBarProtection.addView(
            capacitorLayout,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        content.addView(
            systemBarProtection,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
    }

    private void applySystemBars(boolean light) {
        lightSystemBars = light;
        Window window = getWindow();
        // 浅色必须与 Web 主页的 --app-bg (#F3F4F6) 精确一致。
        int color = light ? Color.rgb(243, 244, 246) : Color.rgb(8, 10, 13);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.clearFlags(
            WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS
                | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION
        );
        // 手势导航栏在 Android 15+ 完全透明，必须同步窗口底色，不能保留黑色开屏背景。
        window.setBackgroundDrawable(new ColorDrawable(color));
        // Capacitor 会按配置先把 WebView 设成开屏黑色，页面就绪后必须同步为当前主题色。
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setBackgroundColor(color);
        }
        window.setStatusBarColor(color);
        window.setNavigationBarColor(color);

        // 禁止系统为三键导航栏自动叠加灰色对比遮罩。
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setAppearanceLightStatusBars(light);
        controller.setAppearanceLightNavigationBars(light);

        // 兼容仍通过 legacy System UI flags 控制导航栏的厂商 ROM。
        View decorView = window.getDecorView();
        int systemUiVisibility = decorView.getSystemUiVisibility();
        if (light) {
            systemUiVisibility |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                systemUiVisibility |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
        } else {
            systemUiVisibility &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                systemUiVisibility &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
        }
        decorView.setSystemUiVisibility(systemUiVisibility);

        // Android 15+ 的系统栏颜色 API 已失效，必须在透明系统栏后实际绘制保护色。
        if (systemBarProtection != null) {
            systemBarProtection.setBackgroundColor(color);
            systemBarProtection.setProtections(Arrays.asList(
                new ColorProtection(WindowInsetsCompat.Side.TOP, color),
                new ColorProtection(WindowInsetsCompat.Side.BOTTOM, color)
            ));
        }
    }

    private void dispatchStartupTransitionComplete() {
        bridge.getWebView().evaluateJavascript(
            "window.dispatchEvent(new Event('native-startup-transition-complete'))",
            null
        );
    }

    private final class StartupBridge {
        @JavascriptInterface
        public void revealContent() {
            runOnUiThread(() -> keepSplashOnScreen = false);
        }

        @JavascriptInterface
        public void setTheme(String theme) {
            runOnUiThread(() -> applySystemBars(isLightTheme(MainActivity.this, theme)));
        }

        @JavascriptInterface
        public void showKeyboard() {
            runOnUiThread(() -> {
                WebView webView = bridge.getWebView();
                webView.requestFocus();

                // DOM 输入框聚焦后延迟请求输入法，确保 WebView 已建立输入连接。
                webView.postDelayed(() -> {
                    InputMethodManager inputMethodManager = (InputMethodManager)
                        getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (inputMethodManager != null) {
                        inputMethodManager.showSoftInput(
                            webView,
                            InputMethodManager.SHOW_IMPLICIT
                        );
                    }
                }, 120L);
            });
        }
    }
}
