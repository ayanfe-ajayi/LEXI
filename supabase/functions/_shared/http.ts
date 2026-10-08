import { createClient } from "@supabase/supabase-js";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function mustEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new AppError(503, `The server needs ${name} configured.`);
  return value;
}
export function adminClient() {
  return createClient(
    mustEnv("SUPABASE_URL"),
    mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export type Admin = ReturnType<typeof adminClient>;
export function check<T>(result: {
  data: T;
  error: { message: string } | null;
}) {
  if (result.error) {
    console.error("Database operation failed:", result.error.message);
    throw new AppError(
      503,
      "Your data could not be updated. Please try again.",
    );
  }
  return result.data;
}
export async function requireUser(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new AppError(401, "Please sign in to continue.");
  const db = adminClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user)
    throw new AppError(401, "Your session has expired. Please sign in again.");
  return { db, user: data.user };
}
export async function quota(db: Admin, user: string) {
  if (!check(await db.rpc("consume_api_quota", { p_user: user })))
    throw new AppError(
      429,
      "You have reached the hourly request limit. Please come back later.",
    );
}
export function serve(handler: (req: Request) => Promise<unknown>) {
  Deno.serve(async (req) => {
    const origin = req.headers.get("origin") || "";
    const allowed = (
      Deno.env.get("ALLOWED_ORIGINS") ||
      "http://localhost:5173,http://127.0.0.1:5173"
    )
      .split(",")
      .map((s) => s.trim());
    const headers = {
      "Access-Control-Allow-Origin": allowed.includes(origin)
        ? origin
        : allowed[0],
      "Access-Control-Allow-Headers":
        "authorization,apikey,content-type,x-client-info,x-cron-secret",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      Vary: "Origin",
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    };
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return new Response(JSON.stringify({ error: "Use POST." }), {
        status: 405,
        headers,
      });
    try {
      if (Number(req.headers.get("content-length") || 0) > 32_768)
        throw new AppError(413, "This request is too large.");
      return new Response(JSON.stringify(await handler(req)), { headers });
    } catch (error) {
      const status =
        error instanceof AppError
          ? error.status
          : error instanceof ZodError
            ? 400
            : 500;
      const message =
        error instanceof AppError
          ? error.message
          : error instanceof ZodError
            ? "Please check the information you entered."
            : "Something went wrong. Please try again.";
      if (status >= 500)
        console.error(
          "Lexi request failed:",
          error instanceof Error ? error.message : "Unknown error",
        );
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers,
      });
    }
  });
}
export async function body(req: Request) {
  const raw = await req.text();
  if (raw.length > 32_768)
    throw new AppError(413, "This request is too large.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError(400, "Invalid request.");
  }
}
