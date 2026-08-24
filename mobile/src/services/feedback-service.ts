import { Preferences } from "@capacitor/preferences";

const apiBaseUrl = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const installIdKey = "feedback-install-id-v1";

async function getInstallId(): Promise<string> {
  const stored = await Preferences.get({ key: installIdKey });
  if (stored.value) return stored.value;

  const value = crypto.randomUUID();
  await Preferences.set({ key: installIdKey, value });
  return value;
}

export async function sendFeedback(title: string, content: string): Promise<void> {
  if (!apiBaseUrl || apiBaseUrl.includes("example.workers.dev")) {
    throw new Error("反馈服务未配置");
  }

  const response = await fetch(`${apiBaseUrl}/v1/feedback`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-install-id": await getInstallId()
    },
    body: JSON.stringify({ title: title.trim(), content: content.trim() })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message || "反馈发送失败，请稍后重试");
  }
}
