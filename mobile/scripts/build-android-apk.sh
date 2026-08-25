#!/usr/bin/env bash

# 构建与生产配置一致、经过 R8 压缩的 Android Release APK 和 AAB。
# 当前 APK 使用本机 Android 测试证书签名以便真机安装；上架前必须换成正式发布密钥。

set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
mobile_dir="$(cd -- "$script_dir/.." && pwd)"
android_dir="$mobile_dir/android"
apk_source="$android_dir/app/build/outputs/apk/release/app-release-unsigned.apk"
aab_source="$android_dir/app/build/outputs/bundle/release/app-release.aab"
output_dir="$mobile_dir/outputs/android"
apk_output="$output_dir/calorie-ai-release.apk"
aab_output="$output_dir/calorie-ai-release-unsigned.aab"

log() {
  printf '\n[%s] %s\n' "APK" "$1"
}

fail() {
  printf '\n[APK] 错误：%s\n' "$1" >&2
  exit 1
}

trap 'fail "打包在第 ${LINENO} 行失败，请检查上方日志。"' ERR

command -v npm >/dev/null 2>&1 || fail "未找到 npm。"
[[ -d "$mobile_dir/node_modules" ]] || fail "依赖尚未安装，请先在 mobile 目录执行 npm install。"
[[ -x "$android_dir/gradlew" ]] || fail "未找到可执行的 Android Gradle Wrapper。"

# 优先使用调用者已配置的 JAVA_HOME；macOS 未配置时自动定位 JDK 21。
if [[ -z "${JAVA_HOME:-}" ]] && [[ -x /usr/libexec/java_home ]]; then
  detected_java_home="$(/usr/libexec/java_home -v 21 2>/dev/null || true)"
  if [[ -n "$detected_java_home" ]]; then
    export JAVA_HOME="$detected_java_home"
  fi
fi

[[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]] || \
  fail "未找到 JDK 21。当前机器应安装到 ~/Library/Java/JavaVirtualMachines/temurin-21.jdk。"

# 解析 Android SDK：环境变量优先，其次使用 macOS 的默认用户目录。
android_sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$android_sdk" && -d "$HOME/Library/Android/sdk" ]]; then
  android_sdk="$HOME/Library/Android/sdk"
fi

[[ -n "$android_sdk" && -d "$android_sdk" ]] || \
  fail "未找到 Android SDK，请配置 ANDROID_HOME。"
[[ -d "$android_sdk/platforms/android-36" ]] || \
  fail "缺少 Android SDK Platform 36。"

build_tools_dir="$android_sdk/build-tools/36.0.0"
[[ -x "$build_tools_dir/zipalign" && -x "$build_tools_dir/apksigner" ]] || \
  fail "缺少 Android SDK Build-Tools 36.0.0。"

# 未配置正式发布密钥时，用 Android 默认测试证书签名 Release 构建，确保 APK 可直接安装。
test_keystore="$HOME/.android/debug.keystore"
[[ -f "$test_keystore" ]] || \
  fail "未找到 Android 测试签名文件：$test_keystore"

export ANDROID_HOME="$android_sdk"
export ANDROID_SDK_ROOT="$android_sdk"

# local.properties 仅保存本机 SDK 路径，已被 Git 忽略。
printf 'sdk.dir=%s\n' "$android_sdk" > "$android_dir/local.properties"

log "构建 Web 资源"
cd "$mobile_dir"
npm run build

log "同步 Capacitor Android 项目"
npx cap sync android

log "执行 Gradle Release 打包"
cd "$android_dir"
./gradlew assembleRelease bundleRelease

[[ -f "$apk_source" ]] || fail "Gradle 已结束，但没有找到 APK 文件。"
[[ -f "$aab_source" ]] || fail "Gradle 已结束，但没有找到 AAB 文件。"

# 对压缩后的 Release APK 执行对齐和测试签名，产物可直接安装到 Android 真机。
mkdir -p "$output_dir"
"$build_tools_dir/zipalign" -f -p 4 "$apk_source" "$apk_output"
"$build_tools_dir/apksigner" sign \
  --ks "$test_keystore" \
  --ks-key-alias androiddebugkey \
  --ks-pass pass:android \
  --key-pass pass:android \
  --v4-signing-enabled false \
  "$apk_output"
"$build_tools_dir/apksigner" verify --verbose "$apk_output"
cp "$aab_source" "$aab_output"

apk_size="$(du -h "$apk_output" | awk '{print $1}')"
apk_hash="$(shasum -a 256 "$apk_output" | awk '{print $1}')"
aab_size="$(du -h "$aab_output" | awk '{print $1}')"
aab_hash="$(shasum -a 256 "$aab_output" | awk '{print $1}')"

log "打包完成"
printf '可安装 Release APK：%s\n大小：%s\nSHA-256：%s\n' "$apk_output" "$apk_size" "$apk_hash"
printf 'AAB：%s\n大小：%s\nSHA-256：%s\n' "$aab_output" "$aab_size" "$aab_hash"
