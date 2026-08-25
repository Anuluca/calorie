import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import {
  SpeechRecognition,
  type SpeechRecognitionPartialResultEvent
} from "@capgo/capacitor-speech-recognition";
import type { NativeToastTone } from "@/services/native-bridge";
import {
  cacheSpeechRecognitionPermission,
  prewarmSpeechRecognition
} from "@/services/speech-recognition-prewarm";

export type VoiceInputState = "idle" | "preparing" | "listening" | "recognizing";

interface VoiceQueryOptions {
  disabled: () => boolean;
  blurInput: () => void;
  updateQuery: (value: string) => void;
  submit: (value: string) => Promise<void>;
  notify: (message: string, tone?: NativeToastTone, duration?: number) => void;
}

const maximumTranscriptLength = 200;
// 用户松开后继续保留一小段收音时间，避免句尾被系统语音识别截断。
const voiceTailCaptureDelay = 1000;

function delay(duration: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration));
}

function speechErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause ?? "");
  const normalized = message.toLowerCase();
  if (normalized.includes("permission") || normalized.includes("denied")) {
    return "请在系统设置中允许麦克风和语音识别权限";
  }
  if (normalized.includes("network") || normalized.includes("server")) {
    return "语音识别网络异常，请重试";
  }
  if (normalized.includes("available") || normalized.includes("support")) {
    return "当前设备不支持语音识别";
  }
  return "语音识别失败，请重试";
}

function readTranscript(event: SpeechRecognitionPartialResultEvent) {
  return (
    event.accumulatedText?.trim() ||
    event.matches?.[0]?.trim() ||
    event.accumulated?.trim() ||
    ""
  );
}

/**
 * 管理按住说话、权限、原生监听器和会话清理。
 * 查询页只接收识别文本和提交回调，不直接依赖语音插件的状态机。
 */
export function useVoiceQuery(options: VoiceQueryOptions) {
  const state = ref<VoiceInputState>("idle");
  const holding = ref(false);
  const transcript = ref("");
  const active = computed(() => state.value !== "idle");
  const buttonLabel = computed(() => {
    if (state.value === "preparing") return "正在准备语音输入";
    if (state.value === "listening") return "松开并识别语音";
    if (state.value === "recognizing") return "正在识别语音";
    return "按住进行语音输入";
  });

  let sessionId = 0;
  let finalizing = false;
  let stopResolver: (() => void) | undefined;
  let audioContext: AudioContext | undefined;
  let capabilityReady = false;
  let permissionGranted = false;
  let setupPromise: Promise<void> | undefined;
  const listenerHandles: PluginListenerHandle[] = [];

  function updateTranscript(value: string) {
    const normalized = value.trim().slice(0, maximumTranscriptLength);
    if (!normalized) return;
    transcript.value = normalized;
    options.updateQuery(normalized);
  }

  function resolveStop() {
    stopResolver?.();
  }

  /** 等待原生识别器释放资源，超时后继续，避免界面永久停留在识别状态。 */
  function waitForStop(timeout = 900) {
    return new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (stopResolver === finish) stopResolver = undefined;
        resolve();
      };
      const timer = window.setTimeout(finish, timeout);
      stopResolver = finish;
    });
  }

  async function ensureListeners() {
    if (listenerHandles.length) return;

    const registrations = await Promise.allSettled([
      SpeechRecognition.addListener("partialResults", (event) => {
        updateTranscript(readTranscript(event));
      }),
      SpeechRecognition.addListener("listeningState", (event) => {
        if (event.state === "started" && holding.value && !finalizing) {
          state.value = "listening";
        }
        if (event.state === "stopped") {
          resolveStop();
          if (!holding.value && !finalizing) state.value = "idle";
        }
      }),
      SpeechRecognition.addListener("readyForNextSession", resolveStop)
    ]);

    const handles = registrations.flatMap((registration) =>
      registration.status === "fulfilled" ? [registration.value] : []
    );
    const failure = registrations.find(
      (registration): registration is PromiseRejectedResult =>
        registration.status === "rejected"
    );
    if (failure) {
      await Promise.allSettled(handles.map((handle) => handle.remove()));
      throw failure.reason;
    }
    listenerHandles.push(...handles);
  }

  /** 仅检查已有权限，不在页面加载时触发系统权限弹窗。 */
  async function warmUp() {
    if (capabilityReady) return;
    if (!setupPromise) {
      setupPromise = (async () => {
        const [capability] = await Promise.all([
          prewarmSpeechRecognition(),
          ensureListeners()
        ]);
        if (!capability.available) {
          throw new Error("Speech recognition is not available");
        }
        permissionGranted = capability.permissionGranted;
        capabilityReady = true;
      })().catch((cause) => {
        setupPromise = undefined;
        throw cause;
      });
    }
    await setupPromise;
  }

  /**
   * 松开后先保留尾音收集时间，再安装停止等待器并通知原生停止。
   * 等待器仍必须先于停止调用创建，否则可能漏掉同步返回的 stopped 事件。
   */
  async function finalize(shouldSubmit: boolean) {
    if (finalizing) return;
    finalizing = true;
    const currentSessionId = sessionId;
    holding.value = false;
    state.value = shouldSubmit ? "recognizing" : "idle";
    if (shouldSubmit) options.notify("正在识别并查询…", "info");

    try {
      if (shouldSubmit) await delay(voiceTailCaptureDelay);

      const stopped = waitForStop();
      await SpeechRecognition.setPTTState({ held: false, mute: true })
        .catch(() => undefined);
      await SpeechRecognition.forceStop({ timeout: 700 }).catch(() => undefined);
      await stopped;

      if (currentSessionId !== sessionId) return;
      const cached = await SpeechRecognition.getLastPartialResult().catch(() => null);
      if (cached?.available) updateTranscript(cached.text);

      const value = transcript.value.trim();
      if (shouldSubmit && value) {
        state.value = "idle";
        await options.submit(value);
      } else if (shouldSubmit) {
        options.notify("未识别到语音，请按住重试", "error", 1800);
      }
    } finally {
      state.value = "idle";
      finalizing = false;
    }
  }

  async function begin() {
    if (options.disabled() || active.value) return;

    const currentSessionId = ++sessionId;
    holding.value = true;
    transcript.value = "";
    state.value = "preparing";
    options.blurInput();

    try {
      await warmUp();

      let requestedPermission = false;
      if (!permissionGranted) {
        requestedPermission = true;
        const permissionResult = await SpeechRecognition.requestPermissions();
        if (permissionResult.speechRecognition !== "granted") {
          throw new Error("Speech recognition permission denied");
        }
        permissionGranted = true;
        cacheSpeechRecognitionPermission();
      }

      // 权限弹窗或 pointercancel 可能已结束按压，不能随后自动启动录音。
      if (currentSessionId !== sessionId || !holding.value) {
        state.value = "idle";
        options.notify(
          requestedPermission ? "已获得权限，请重新按住说话" : "按住时间太短，请重新尝试",
          "info"
        );
        return;
      }

      await SpeechRecognition.setPTTState({ held: true, mute: true });
      await SpeechRecognition.start({
        language: "zh-CN",
        maxResults: 3,
        popup: false,
        partialResults: true,
        addPunctuation: true,
        continuousPTT: true,
        muteRecognizerBeep: true,
        contextualStrings: ["大卡", "千卡", "克", "毫升", "一碗", "一份"]
      });

      if (currentSessionId !== sessionId) {
        await finalize(false);
        return;
      }
      if (!holding.value) {
        await finalize(true);
        return;
      }
      state.value = "listening";
    } catch (cause) {
      holding.value = false;
      state.value = "idle";
      options.notify(speechErrorMessage(cause), "error", 1800);
      await SpeechRecognition.setPTTState({ held: false, mute: true })
        .catch(() => undefined);
    }
  }

  function end() {
    if (!holding.value) return;
    holding.value = false;
    if (state.value === "listening") void finalize(true);
    // preparing 状态由 begin 在异步准备完成后收尾。
  }

  function cancel() {
    if (!active.value) return;
    holding.value = false;
    sessionId += 1;
    if (state.value === "listening") void finalize(false);
    else state.value = "idle";
  }

  /** 在用户手势内播放极短提示音，避免增加音频资源文件。 */
  function playBeep(phase: "press" | "release") {
    try {
      audioContext ??= new AudioContext();
      const context = audioContext;
      const play = () => {
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(phase === "press" ? 760 : 920, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.055, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.07);
      };

      if (context.state === "suspended") {
        void context.resume().then(play).catch(() => undefined);
      } else {
        play();
      }
    } catch {
      // 静音模式或浏览器不支持 Web Audio 时仅保留触感反馈。
    }
  }

  function playFeedback(phase: "press" | "release") {
    if (Capacitor.isNativePlatform()) {
      void Haptics.impact({
        style: phase === "press" ? ImpactStyle.Light : ImpactStyle.Medium
      }).catch(() => undefined);
    } else {
      navigator.vibrate?.(phase === "press" ? 18 : 28);
    }
    playBeep(phase);
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    const button = event.currentTarget;
    if (button instanceof HTMLElement) button.setPointerCapture(event.pointerId);
    playFeedback("press");
    void begin();
  }

  function handlePointerUp(event: PointerEvent) {
    event.preventDefault();
    const button = event.currentTarget;
    if (button instanceof HTMLElement && button.hasPointerCapture(event.pointerId)) {
      button.releasePointerCapture(event.pointerId);
    }
    end();
    playFeedback("release");
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
    event.preventDefault();
    playFeedback("press");
    void begin();
  }

  function handleKeyUp(event: KeyboardEvent) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    end();
    playFeedback("release");
  }

  onMounted(() => {
    // Web 实现明确不支持识别，不在预览页面触发无意义的插件调用。
    if (Capacitor.isNativePlatform()) void warmUp().catch(() => undefined);
  });

  onBeforeUnmount(() => {
    void audioContext?.close().catch(() => undefined);
    audioContext = undefined;
    sessionId += 1;
    holding.value = false;
    resolveStop();
    if (active.value) {
      void SpeechRecognition.setPTTState({ held: false, mute: true })
        .then(() => SpeechRecognition.forceStop({ timeout: 300 }))
        .catch(() => undefined);
    }
    const handles = listenerHandles.splice(0);
    void Promise.allSettled(handles.map((handle) => handle.remove()));
    capabilityReady = false;
    setupPromise = undefined;
  });

  return {
    state,
    holding,
    active,
    buttonLabel,
    cancel,
    handlePointerDown,
    handlePointerUp,
    handleKeyDown,
    handleKeyUp
  };
}
