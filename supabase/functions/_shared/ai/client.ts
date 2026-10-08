import { z } from "zod";
import { AppError } from "../http.ts";
export const aiAvailable = () => Boolean(Deno.env.get("AI_API_KEY"));
export async function aiRequest(path: string, payload: unknown): Promise<any> {
  const key = Deno.env.get("AI_API_KEY");
  if (!key)
    throw new AppError(
      503,
      "Your AI tutor is not configured yet. Add AI_API_KEY to the server secrets.",
    );
  const base = (
    Deno.env.get("AI_BASE_URL") || "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${base}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(40_000),
    });
  } catch {
    throw new AppError(503, "The AI service took too long. Please try again.");
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    const code = detail?.error?.code;
    const type = detail?.error?.type;
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
      status: response.status,
      category: billing
        ? "billing"
        : response.status === 429
          ? "rate_limit"
          : "provider",
    });
    throw new AppError(
      response.status === 429 ? 429 : 503,
      billing
        ? "The AI account has no available credits or has reached its spending limit. Check the provider's billing settings."
        : response.status === 429
          ? "The AI service is busy. Please try again shortly."
          : "The AI service is unavailable. Please try again.",
    );
  }
  return response.json();
}
export function model(strong = false) {
  return Deno.env.get(strong ? "AI_TUTOR_MODEL" : "AI_MODEL") || "gpt-4.1-mini";
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
    model: Deno.env.get("AI_EMBEDDING_MODEL") || "text-embedding-3-small",
    input: text,
    dimensions: 1536,
  });
  const vector = result.data?.[0]?.embedding;
  if (
    !Array.isArray(vector) ||
    vector.length !== 1536 ||
    !vector.every((n) => typeof n === "number" && Number.isFinite(n))
  )
    throw new AppError(502, "Meaning search could not process this query.");
  return vector;
}
