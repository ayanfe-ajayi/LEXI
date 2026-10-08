// @ts-nocheck
// Generated JavaScript from checked TypeScript. Paste all of this into the Dashboard index.ts.

// supabase/functions/reverse-search/index.ts
import { z as z2 } from "npm:zod@4.1.11";

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
async function quota(db, user) {
  if (!check(await db.rpc("consume_api_quota", { p_user: user })))
    throw new AppError(
      429,
      "You have reached the hourly request limit. Please come back later."
    );
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

// supabase/functions/_shared/ai/client.ts
import { z } from "npm:zod@4.1.11";
var aiAvailable = () => Boolean(Deno.env.get("AI_API_KEY"));
async function aiRequest(path, payload) {
  const key = Deno.env.get("AI_API_KEY");
  if (!key)
    throw new AppError(
      503,
      "Your AI tutor is not configured yet. Add AI_API_KEY to the server secrets."
    );
  const base = (Deno.env.get("AI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
  let response;
  try {
    response = await fetch(`${base}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4e4)
    });
  } catch {
    throw new AppError(503, "The AI service took too long. Please try again.");
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const code = detail?.error?.code;
    const type = detail?.error?.type;
    const billing = [
      "insufficient_quota",
      "credit_balance_exhausted",
      "billing_hard_limit_reached",
      "organization_spend_limit_exceeded",
      "project_spend_limit_exceeded",
      "organization_usage_limit_exceeded"
    ].includes(code) || type === "insufficient_quota";
    console.warn("AI provider request failed", {
      status: response.status,
      category: billing ? "billing" : response.status === 429 ? "rate_limit" : "provider"
    });
    throw new AppError(
      response.status === 429 ? 429 : 503,
      billing ? "The AI account has no available credits or has reached its spending limit. Check the provider's billing settings." : response.status === 429 ? "The AI service is busy. Please try again shortly." : "The AI service is unavailable. Please try again."
    );
  }
  return response.json();
}
function model(strong = false) {
  return Deno.env.get(strong ? "AI_TUTOR_MODEL" : "AI_MODEL") || "gpt-4.1-mini";
}
async function structured(schema, system, input, strong = false) {
  const jsonSchema = z.toJSONSchema(schema);
  delete jsonSchema.$schema;
  const result = await aiRequest("chat/completions", {
    model: model(strong),
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(input) }
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "lexi_response", strict: true, schema: jsonSchema }
    }
  });
  const choice = result.choices?.[0];
  if (choice?.finish_reason !== "stop" || choice.message?.refusal)
    throw new AppError(
      502,
      "The tutor could not finish this response. Please try a different question."
    );
  try {
    return schema.parse(JSON.parse(choice.message.content));
  } catch {
    console.error("Invalid structured AI output");
    throw new AppError(
      502,
      "The tutor returned an incomplete response. Nothing was saved. Please try again."
    );
  }
}
async function embedding(text) {
  const result = await aiRequest("embeddings", {
    model: Deno.env.get("AI_EMBEDDING_MODEL") || "text-embedding-3-small",
    input: text,
    dimensions: 1536
  });
  const vector = result.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== 1536 || !vector.every((n) => typeof n === "number" && Number.isFinite(n)))
    throw new AppError(502, "Meaning search could not process this query.");
  return vector;
}

// supabase/functions/reverse-search/index.ts
serve(async (req) => {
  const { db, user } = await requireUser(req);
  const data = z2.object({
    query: z2.string().trim().min(2).max(500),
    mine: z2.boolean().default(true)
  }).parse(await body(req));
  await quota(db, user.id);
  const vector = aiAvailable() ? await embedding(data.query) : null;
  const results = check(
    await db.rpc("hybrid_search", {
      p_user: user.id,
      p_query: data.query,
      p_embedding: vector,
      p_mine: data.mine
    })
  );
  let explanation = "";
  if (results?.length && aiAvailable()) {
    const response = await structured(
      z2.object({ explanation: z2.string().max(1800) }),
      "Explain the distinctions between the supplied vocabulary results in a few useful sentences. Say when matches are approximate. Do not invent personal history or words absent from the results.",
      { query: data.query, results }
    );
    explanation = response.explanation;
  }
  return { results, explanation, mode: vector ? "hybrid" : "text" };
});
