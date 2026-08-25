import { Capacitor } from "@capacitor/core";
import { SpeechRecognition } from "@capgo/capacitor-speech-recognition";

export interface SpeechRecognitionCapability {
  available: boolean;
  permissionGranted: boolean;
}

let prewarmPromise: Promise<SpeechRecognitionCapability> | undefined;
let cachedCapability: SpeechRecognitionCapability | undefined;

/**
 * 在应用启动阶段提前完成不会启用麦克风的能力和权限检查。
 * 结果在本次 WebView 生命周期内共享，避免切换 Tab 后重复调用原生桥接。
 */
export function prewarmSpeechRecognition() {
  if (!Capacitor.isNativePlatform()) {
    return Promise.resolve({ available: false, permissionGranted: false });
  }
  if (cachedCapability) return Promise.resolve(cachedCapability);

  prewarmPromise ??= Promise.all([
    SpeechRecognition.available(),
    SpeechRecognition.checkPermissions()
  ])
    .then(([availability, permission]) => {
      cachedCapability = {
        available: availability.available,
        permissionGranted: permission.speechRecognition === "granted"
      };
      return cachedCapability;
    })
    .catch((cause) => {
      prewarmPromise = undefined;
      throw cause;
    });

  return prewarmPromise;
}

/** 首次授权成功后同步更新缓存，后续语音会话不再重复检查权限。 */
export function cacheSpeechRecognitionPermission() {
  if (cachedCapability) cachedCapability.permissionGranted = true;
}
