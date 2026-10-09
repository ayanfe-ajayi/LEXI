import { z } from "zod";
import { AppError } from "../http.ts";
export function provider() {
  const selected = Deno.env.get("AI_PROVIDER");
  if (selected && !["gemini", "openai"].includes(selected))
    throw new AppError(503, "AI_PROVIDER must be gemini or openai.");
  return selected || (Deno.env.get("GEMINI_API_KEY") ? "gemini" : "openai");
}
export const aiAvailable = () =>
  Boolean(
    Deno.env.get(provider() === "gemini" ? "GEMINI_API_KEY" : "AI_API_KEY"),
  );
export async function aiRequest(path: string, payload: unknown): Promise<any> {
  const google = provider() === "gemini";
  const key = Deno.env.get(google ? "GEMINI_API_KEY" : "AI_API_KEY");
  if (!key)
    throw new AppError(
      503,
      `Your AI tutor is not configured yet. Add ${google ? "GEMINI_API_KEY" : "AI_API_KEY"} to the server secrets.`,
    );
  const base = (
    google
      ? "https://generativelanguage.googleapis.com/v1beta/openai"
      : Deno.env.get("AI_BASE_URL") || "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  let url = `${base}/${path}`;
  let requestPayload = payload;
  let headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (google && path === "embeddings") {
    // Native endpoint explicitly controls dimensionality for our pgvector schema.
    const input = payload as { model: string; input: string };
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.model)}:embedContent`;
    headers = { "x-goog-api-key": key, "Content-Type": "application/json" };
    requestPayload = {
      content: { parts: [{ text: input.input }] },
      outputDimensionality: 1536,
    };
  } else if (google && path === "chat/completions") {
    const input = { ...(payload as Record<string, unknown>) };
    delete input.parallel_tool_calls;
    // Flash/Lite can answer these bounded vocabulary tasks without a thinking budget.
    if (String(input.model).startsWith("gemini-2.5-flash"))
      input.reasoning_effort = "none";
    requestPayload = input;
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestPayload),
      signal: AbortSignal.timeout(40_000),
    });
  } catch {
    throw new AppError(503, "The AI service took too long. Please try again.");
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const code = detail?.error?.code;
    const type = detail?.error?.type;
    const googleStatus = detail?.error?.status;
    // Classify provider errors without logging messages that may echo private content.
    const invalidKey =
      google &&
      /API[_ ]KEY[_ ]INVALID|API key not valid|invalid API key/i.test(
        `${googleStatus || ""} ${detail?.error?.message || ""} ${JSON.stringify(detail?.error?.details || [])}`,
      );
    const billing =
      [
        "insufficient_quota",
        "credit_balance_exhausted",
        "billing_hard_limit_reached",
        "organization_spend_limit_exceeded",
        "project_spend_limit_exceeded",
        "organization_usage_limit_exceeded",
      ].includes(code) || type === "insufficient_quota";
    // Never log provider payloads, which can include request content.
    console.warn("AI provider request failed", {
      provider: google ? "gemini" : "openai",
      request: path,
      status: response.status,
      model:
        typeof (payload as any)?.model === "string" &&
        /^[a-zA-Z0-9._-]{1,100}$/.test((payload as any).model)
          ? (payload as any).model
          : "custom",
      provider_status:
        typeof googleStatus === "string" && /^[A-Z_]{1,60}$/.test(googleStatus)
          ? googleStatus
          : undefined,
      category: invalidKey
        ? "invalid_key"
        : google && response.status === 404
          ? "model_unavailable"
          : google && response.status === 400
            ? "invalid_request"
            : billing
              ? "billing"
              : response.status === 429
                ? "rate_limit"
                : "provider",
    });
    throw new AppError(
      response.status === 429 ? 429 : 503,
      invalidKey
        ? "Google rejected the API key. Copy the full key from Google AI Studio into GEMINI_API_KEY in Supabase secrets, without quotes or extra spaces."
        : google && response.status === 404
          ? "The configured Google model is unavailable for this project. Check GEMINI_MODEL, GEMINI_TUTOR_MODEL and GEMINI_EMBEDDING_MODEL in Supabase secrets."
          : google && response.status === 400
            ? "Google rejected the AI request. Check the function's logs for the model and request type, and confirm the latest Lexi functions are deployed."
            : google && response.status === 429
              ? "Google's AI request limit has been reached. Please try again later. You can check your quota in Google AI Studio."
              : google && [401, 403].includes(response.status)
                ? "Google could not authorise this request. Check GEMINI_API_KEY and the project's API access."
                : billing
                  ? "The AI account has no available credits or has reached its spending limit. Check the provider's billing settings."
                  : response.status === 429
                    ? "The AI service is busy. Please try again shortly."
                    : "The AI service is unavailable. Please try again.",
    );
  }
  return response.json();
}
export function model(strong = false) {
  if (provider() === "gemini")
    return (
      Deno.env.get(strong ? "GEMINI_TUTOR_MODEL" : "GEMINI_MODEL") ||
      "gemini-3.5-flash-lite"
    );
  return Deno.env.get(strong ? "AI_TUTOR_MODEL" : "AI_MODEL") || "gpt-4.1-mini";
}
export function embeddingModel() {
  return provider() === "gemini"
    ? Deno.env.get("GEMINI_EMBEDDING_MODEL") || "gemini-embedding-2"
    : Deno.env.get("AI_EMBEDDING_MODEL") || "text-embedding-3-small";
}
export function embeddingSpace() {
  const host =
    provider() === "gemini"
      ? "google"
      : (Deno.env.get("AI_BASE_URL") || "https://api.openai.com/v1").replace(
          /\/$/,
          "",
        );
  return `${host}:${embeddingModel()}:1536`;
}
export async function optionalEmbedding(text: string) {
  if (!aiAvailable()) return null;
  try {
    return await embedding(text);
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    console.warn("Meaning search using text fallback", {
      status: error.status,
    });
    return null;
  }
}
export async function structured<T>(
  schema: z.ZodType<T>,
  system: string,
  input: unknown,
  strong = false,
): Promise<T> {
  const jsonSchema = z.toJSONSchema(schema);
  delete jsonSchema.$schema;
  const result = await aiRequest("chat/completions", {
    model: model(strong),
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(input) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "lexi_response", strict: true, schema: jsonSchema },
    },
  });
  const choice = result.choices?.[0];
  if (choice?.finish_reason !== "stop" || choice.message?.refusal)
    throw new AppError(
      502,
      "The tutor could not finish this response. Please try a different question.",
    );
  try {
    return schema.parse(JSON.parse(choice.message.content));
  } catch {
    console.error("Invalid structured AI output");
    throw new AppError(
      502,
      "The tutor returned an incomplete response. Nothing was saved. Please try again.",
    );
  }
}
export async function embedding(text: string): Promise<number[]> {
  const result = await aiRequest("embeddings", {
    model: embeddingModel(),
    input: text,
    dimensions: 1536,
  });
  const vector =
    provider() === "gemini"
      ? result.embedding?.values
      : result.data?.[0]?.embedding;
  if (
    !Array.isArray(vector) ||
    vector.length !== 1536 ||
    !vector.every((n) => typeof n === "number" && Number.isFinite(n))
  )
    throw new AppError(502, "Meaning search could not process this query.");
  if (provider() === "gemini") {
    const magnitude = Math.hypot(...vector);
    if (!magnitude)
      throw new AppError(502, "Meaning search could not process this query.");
    return vector.map((n: number) => n / magnitude);
  }
  return vector;
}
