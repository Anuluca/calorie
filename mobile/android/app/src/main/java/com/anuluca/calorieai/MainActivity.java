package com.anuluca.calorieai;

import android.content.SharedPreferences;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatDelegate;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PREFERENCES_GROUP = "CapacitorStorage";
    private static final String THEME_KEY = "app-theme-v1";

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

        super.onCreate(savedInstanceState);
        getWindow().setBackgroundDrawableResource(R.color.splash_background);
    }
}
