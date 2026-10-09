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
    if (/hybrid_search_v2/i.test(result.error.message))
      throw new AppError(
        503,
        "Lexi needs its Google database update. Run gemini-upgrade.sql in the Supabase SQL Editor, then try again."
      );
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
function provider() {
  const selected = Deno.env.get("AI_PROVIDER");
  if (selected && !["gemini", "openai"].includes(selected))
    throw new AppError(503, "AI_PROVIDER must be gemini or openai.");
  return selected || (Deno.env.get("GEMINI_API_KEY") ? "gemini" : "openai");
}
var aiAvailable = () => Boolean(
  Deno.env.get(provider() === "gemini" ? "GEMINI_API_KEY" : "AI_API_KEY")
);
async function aiRequest(path, payload) {
  const google = provider() === "gemini";
  const key = Deno.env.get(google ? "GEMINI_API_KEY" : "AI_API_KEY");
  if (!key)
    throw new AppError(
      503,
      `Your AI tutor is not configured yet. Add ${google ? "GEMINI_API_KEY" : "AI_API_KEY"} to the server secrets.`
    );
  const base = (google ? "https://generativelanguage.googleapis.com/v1beta/openai" : Deno.env.get("AI_BASE_URL") || "https://api.openai.com/v1").replace(/\/$/, "");
  let url = `${base}/${path}`;
  let requestPayload = payload;
  let headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
  if (google && path === "embeddings") {
    const input = payload;
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:embedContent`;
    headers = { "x-goog-api-key": key, "Content-Type": "application/json" };
    requestPayload = {
      content: { parts: [{ text: input.input }] },
      outputDimensionality: 1536
    };
  } else if (google && path === "chat/completions") {
    const input = { ...payload };
    delete input.parallel_tool_calls;
    if (String(input.model).startsWith("gemini-2.5-flash"))
      input.reasoning_effort = "none";
    requestPayload = input;
  }
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(4e4)
    });
  } catch {
    throw new AppError(503, "The AI service took too long. Please try again.");
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const code = detail?.error?.code;
    const type = detail?.error?.type;
    const googleStatus = detail?.error?.status;
    const invalidKey = google && /API[_ ]KEY[_ ]INVALID|API key not valid|invalid API key/i.test(
      `${googleStatus || ""} ${detail?.error?.message || ""} ${JSON.stringify(detail?.error?.details || [])}`
    );
    const billing = [
      "insufficient_quota",
      "credit_balance_exhausted",
      "billing_hard_limit_reached",
      "organization_spend_limit_exceeded",
      "project_spend_limit_exceeded",
      "organization_usage_limit_exceeded"
    ].includes(code) || type === "insufficient_quota";
    console.warn("AI provider request failed", {
      provider: google ? "gemini" : "openai",
      request: path,
      status: response.status,
      model: typeof payload?.model === "string" && /^[a-zA-Z0-9._-]{1,100}$/.test(payload.model) ? payload.model : "custom",
      provider_status: typeof googleStatus === "string" && /^[A-Z_]{1,60}$/.test(googleStatus) ? googleStatus : void 0,
      category: invalidKey ? "invalid_key" : google && response.status === 404 ? "model_unavailable" : google && response.status === 400 ? "invalid_request" : billing ? "billing" : response.status === 429 ? "rate_limit" : "provider"
    });
    throw new AppError(
      response.status === 429 ? 429 : 503,
      invalidKey ? "Google rejected the API key. Copy the full key from Google AI Studio into GEMINI_API_KEY in Supabase secrets, without quotes or extra spaces." : google && response.status === 404 ? "The configured Google model is unavailable for this project. Check GEMINI_MODEL, GEMINI_TUTOR_MODEL and GEMINI_EMBEDDING_MODEL in Supabase secrets." : google && response.status === 400 ? "Google rejected the AI request. Check the function's logs for the model and request type, and confirm the latest Lexi functions are deployed." : google && response.status === 429 ? "Google's AI request limit has been reached. Please try again later. You can check your quota in Google AI Studio." : google && [401, 403].includes(response.status) ? "Google could not authorise this request. Check GEMINI_API_KEY and the project's API access." : billing ? "The AI account has no available credits or has reached its spending limit. Check the provider's billing settings." : response.status === 429 ? "The AI service is busy. Please try again shortly." : "The AI service is unavailable. Please try again."
    );
  }
  return response.json();
}
function model(strong = false) {
  if (provider() === "gemini")
    return Deno.env.get(strong ? "GEMINI_TUTOR_MODEL" : "GEMINI_MODEL") || "gemini-3.5-flash-lite";
  return Deno.env.get(strong ? "AI_TUTOR_MODEL" : "AI_MODEL") || "gpt-4.1-mini";
}
function embeddingModel() {
  return provider() === "gemini" ? Deno.env.get("GEMINI_EMBEDDING_MODEL") || "gemini-embedding-2" : Deno.env.get("AI_EMBEDDING_MODEL") || "text-embedding-3-small";
}
function embeddingSpace() {
  const host = provider() === "gemini" ? "google" : (Deno.env.get("AI_BASE_URL") || "https://api.openai.com/v1").replace(
    /\/$/,
    ""
  );
  return `${host}:${embeddingModel()}:1536`;
}
async function optionalEmbedding(text) {
  if (!aiAvailable()) return null;
  try {
    return await embedding(text);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    console.warn("Meaning search using text fallback", {
      status: error.status
    });
    return null;
  }
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
    model: embeddingModel(),
    input: text,
    dimensions: 1536
  });
  const vector = provider() === "gemini" ? result.embedding?.values : result.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== 1536 || !vector.every((n) => typeof n === "number" && Number.isFinite(n)))
    throw new AppError(502, "Meaning search could not process this query.");
  if (provider() === "gemini") {
    const magnitude = Math.hypot(...vector);
    if (!magnitude)
      throw new AppError(502, "Meaning search could not process this query.");
    return vector.map((n) => n / magnitude);
  }
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
  const vector = await optionalEmbedding(data.query);
  const results = check(
    await db.rpc("hybrid_search_v2", {
      p_user: user.id,
      p_query: data.query,
      p_embedding: vector,
      p_mine: data.mine,
      p_embedding_model: vector ? embeddingSpace() : null
    })
  );
  let explanation = "";
  if (results?.length && vector && aiAvailable()) {
    try {
      const response = await structured(
        z2.object({ explanation: z2.string().max(1800) }),
        "Explain the distinctions between the supplied vocabulary results in a few useful sentences. Say when matches are approximate. Do not invent personal history or words absent from the results.",
        { query: data.query, results }
      );
      explanation = response.explanation;
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
      console.warn("Search explanation skipped", { status: error.status });
    }
  }
  return { results, explanation, mode: vector ? "hybrid" : "text" };
});
