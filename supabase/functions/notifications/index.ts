import { z } from "zod";
import webpush from "web-push";
import {
  serve,
  body,
  requireUser,
  mustEnv,
  adminClient,
  check,
  AppError,
} from "../_shared/http.ts";
serve(async (req) => {
  const input = z
    .object({ action: z.enum(["config", "dispatch"]) })
    .parse(await body(req));
  if (input.action === "config") {
    await requireUser(req);
    return { public_key: Deno.env.get("VAPID_PUBLIC_KEY") || null };
  }
  const cron = Deno.env.get("CRON_SECRET");
  if (!cron || req.headers.get("x-cron-secret") !== cron)
    throw new AppError(401, "Not authorised.");
  webpush.setVapidDetails(
    mustEnv("VAPID_SUBJECT"),
    mustEnv("VAPID_PUBLIC_KEY"),
    mustEnv("VAPID_PRIVATE_KEY"),
  );
  const db = adminClient();
  const reminders = check(await db.rpc("claim_due_reminders")) || [];
  let sent = 0;
  for (const reminder of reminders) {
    const subscriptions =
      check(
        await db
          .from("push_subscriptions")
          .select("*")
          .eq("user_id", reminder.user_id),
      ) || [];
    let delivered = false;
    for (const sub of subscriptions) {
      // Prevent outbound requests to arbitrary/private hosts supplied as endpoints.
      const url = new URL(sub.endpoint);
      const validHosts = [
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
        "notify.windows.com",
      ];
      if (
        url.protocol !== "https:" ||
        !validHosts.some(
          (h) => url.hostname === h || url.hostname.endsWith(`.${h}`),
        )
      )
        continue;
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: reminder.title,
            body: reminder.body,
            url: "/review",
          }),
          { TTL: 3600, timeout: 10_000 },
        );
        delivered = true;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410)
          check(await db.from("push_subscriptions").delete().eq("id", sub.id));
      }
    }
    check(
      await db
        .from("reminders")
        .update({
          status: delivered ? "sent" : "failed",
          sent_at: delivered ? new Date().toISOString() : null,
        })
        .eq("id", reminder.id),
    );
    if (delivered) sent++;
  }
  return { sent, processed: reminders.length };
});
