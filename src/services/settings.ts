import { supabase } from "../lib/supabase";
import { checked, invoke } from "../lib/api";
import type { Preferences } from "../types";
export async function saveSettings(
  user: string,
  name: string,
  preferences: Preferences,
) {
  checked(
    await supabase
      .from("profiles")
      .update({ display_name: name, timezone: preferences.timezone })
      .eq("id", user),
  );
  checked(
    await supabase
      .from("reminder_preferences")
      .upsert({ ...preferences, user_id: user }, { onConflict: "user_id" }),
  );
}
export async function enablePush(user: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    throw new Error("Push notifications are not supported in this browser.");
  const { public_key } = await invoke<{ public_key: string | null }>(
    "notifications",
    { action: "config" },
  );
  if (!public_key)
    throw new Error(
      "Push delivery is not configured yet. Add the VAPID secrets on the server first.",
    );
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error(
      "Notifications were not allowed. You can change this in your browser settings.",
    );
  const registration = await navigator.serviceWorker.ready;
  const bytes = Uint8Array.from(
    atob(
      public_key
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(public_key.length / 4) * 4, "="),
    ),
    (c) => c.charCodeAt(0),
  );
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes,
    }));
  const json = subscription.toJSON();
  checked(
    await supabase.from("push_subscriptions").upsert(
      {
        user_id: user,
        endpoint: subscription.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      },
      { onConflict: "user_id,endpoint" },
    ),
  );
  return true;
}
export async function disablePush(user: string) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    checked(
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", user)
        .eq("endpoint", subscription.endpoint),
    );
    await subscription.unsubscribe();
  }
}
