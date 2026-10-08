// @ts-nocheck
// Generated JavaScript from checked TypeScript. Paste all of this into the Dashboard index.ts.

// supabase/functions/notifications/index.ts
import { z } from "npm:zod@4.1.11";
import webpush from "npm:web-push@3.6.7";

// supabase/functions/_shared/http.ts
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { ZodError } from "npm:zod@4.1.11";
var AppError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
  status;
};
function mustEnv(name) {
  const value = Deno.env.get(name);
  if (!value) throw new AppError(503, `The server needs ${name} configured.`);
  return value;
}
function adminClient() {
  return createClient(
    mustEnv("SUPABASE_URL"),
    mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
function check(result) {
  if (result.error) {
    console.error("Database operation failed:", result.error.message);
    throw new AppError(
      503,
      "Your data could not be updated. Please try again."
    );
  }
  return result.data;
}
async function requireUser(req) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new AppError(401, "Please sign in to continue.");
  const db = adminClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user)
    throw new AppError(401, "Your session has expired. Please sign in again.");
  return { db, user: data.user };
}
function serve(handler) {
  Deno.serve(async (req) => {
    const origin = req.headers.get("origin") || "";
    const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:5173,http://127.0.0.1:5173").split(",").map((s) => s.trim());
    const headers = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
      "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info,x-cron-secret",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      Vary: "Origin",
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    };
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return new Response(JSON.stringify({ error: "Use POST." }), {
        status: 405,
        headers
      });
    try {
      if (Number(req.headers.get("content-length") || 0) > 32768)
        throw new AppError(413, "This request is too large.");
      return new Response(JSON.stringify(await handler(req)), { headers });
    } catch (error) {
      const status = error instanceof AppError ? error.status : error instanceof ZodError ? 400 : 500;
      const message = error instanceof AppError ? error.message : error instanceof ZodError ? "Please check the information you entered." : "Something went wrong. Please try again.";
      if (status >= 500)
        console.error(
          "Lexi request failed:",
          error instanceof Error ? error.message : "Unknown error"
        );
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers
      });
    }
  });
}
async function body(req) {
  const raw = await req.text();
  if (raw.length > 32768)
    throw new AppError(413, "This request is too large.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError(400, "Invalid request.");
  }
}

// supabase/functions/notifications/index.ts
serve(async (req) => {
  const input = z.object({ action: z.enum(["config", "dispatch"]) }).parse(await body(req));
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
    mustEnv("VAPID_PRIVATE_KEY")
  );
  const db = adminClient();
  const reminders = check(await db.rpc("claim_due_reminders")) || [];
  let sent = 0;
  for (const reminder of reminders) {
    const subscriptions = check(
      await db.from("push_subscriptions").select("*").eq("user_id", reminder.user_id)
    ) || [];
    let delivered = false;
    for (const sub of subscriptions) {
      const url = new URL(sub.endpoint);
      const validHosts = [
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
        "notify.windows.com"
      ];
      if (url.protocol !== "https:" || !validHosts.some(
        (h) => url.hostname === h || url.hostname.endsWith(`.${h}`)
      ))
        continue;
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          JSON.stringify({
            title: reminder.title,
            body: reminder.body,
            url: "/review"
          }),
          { TTL: 3600, timeout: 1e4 }
        );
        delivered = true;
      } catch (error) {
        const status = error.statusCode;
        if (status === 404 || status === 410)
          check(await db.from("push_subscriptions").delete().eq("id", sub.id));
      }
    }
    check(
      await db.from("reminders").update({
        status: delivered ? "sent" : "failed",
        sent_at: delivered ? (/* @__PURE__ */ new Date()).toISOString() : null
      }).eq("id", reminder.id)
    );
    if (delivered) sent++;
  }
  return { sent, processed: reminders.length };
});
