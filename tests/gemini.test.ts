import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  aiAvailable,
  aiRequest,
  embedding,
  embeddingSpace,
  model,
  optionalEmbedding,
  provider,
  structured,
} from "../supabase/functions/_shared/ai/client";
import { indexWord } from "../supabase/functions/_shared/dictionary";

let secrets: Record<string, string>;
beforeEach(() => {
  secrets = {
    GEMINI_API_KEY: "google-test-key",
    AI_API_KEY: "old-openai-key",
    AI_MODEL: "old-model",
    AI_BASE_URL: "https://old-provider.invalid/v1",
  };
  vi.stubGlobal("Deno", { env: { get: (name: string) => secrets[name] } });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Gemini integration", () => {
  it("selects Google when its key is saved and ignores old OpenAI settings", async () => {
    expect(provider()).toBe("gemini");
    expect(aiAvailable()).toBe(true);
    expect(model()).toBe("gemini-3.5-flash-lite");
    expect(model(true)).toBe("gemini-3.5-flash-lite");
    expect(embeddingSpace()).toBe("google:gemini-embedding-2:1536");
    const fetchMock = vi.fn(async () => Response.json({ choices: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await aiRequest("chat/completions", {
      model: model(true),
      messages: [],
      tools: [],
      tool_choice: "required",
      parallel_tool_calls: false,
    });
    const [url, options] = fetchMock.mock.calls[0] as any;
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
    expect(options.headers.Authorization).toBe("Bearer google-test-key");
    const payload = JSON.parse(options.body);
    expect(payload.tool_choice).toBe("required");
    expect(payload.parallel_tool_calls).toBeUndefined();
    expect(payload.reasoning_effort).toBeUndefined();
  });
  it("keeps explicit OpenAI configuration available", () => {
    secrets.AI_PROVIDER = "openai";
    expect(provider()).toBe("openai");
    expect(model()).toBe("old-model");
    delete secrets.AI_API_KEY;
    expect(aiAvailable()).toBe(false);
  });
  it("uses explicit current Google model settings without disabling Gemini 3 thinking", async () => {
    secrets.GEMINI_MODEL = "gemini-3.5-flash-lite";
    secrets.GEMINI_TUTOR_MODEL = "gemini-3.5-flash-lite";
    const fetchMock = vi.fn(async () => Response.json({ choices: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await aiRequest("chat/completions", { model: model(true), messages: [] });
    const options = fetchMock.mock.calls[0][1] as any;
    expect(JSON.parse(options.body).reasoning_effort).toBeUndefined();
  });
  it("distinguishes unavailable models from invalid keys and logs no private provider message", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        { error: { status: "NOT_FOUND", message: "private prompt echo" } },
        { status: 404 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      aiRequest("chat/completions", { model: model() }),
    ).rejects.toThrow("model is unavailable");
    expect(vi.mocked(console.warn).mock.calls[0][1]).toMatchObject({
      model: model(),
      request: "chat/completions",
      category: "model_unavailable",
      provider_status: "NOT_FOUND",
    });
    fetchMock.mockImplementation(async () =>
      Response.json(
        {
          error: {
            status: "INVALID_ARGUMENT",
            message: "API key not valid. secret-key-value",
            details: [{ reason: "API_KEY_INVALID" }],
          },
        },
        { status: 400 },
      ),
    );
    await expect(
      aiRequest("embeddings", {
        model: "gemini-embedding-2",
        input: "private user query",
      }),
    ).rejects.toThrow("Google rejected the API key");
    const logged = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(logged).not.toContain("private");
    expect(logged).not.toContain("secret-key-value");
  });
  it("validates structured Google responses and rejects malformed output", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        choices: [
          { finish_reason: "stop", message: { content: '{"correct":true}' } },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(
      await structured(z.object({ correct: z.boolean() }), "grade", {}),
    ).toEqual({ correct: true });
    fetchMock.mockImplementation(async () =>
      Response.json({
        choices: [
          { finish_reason: "stop", message: { content: '{"correct":"yes"}' } },
        ],
      }),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      structured(z.object({ correct: z.boolean() }), "grade", {}),
    ).rejects.toThrow("incomplete response");
  });
  it("requests native 1536-dimensional Google vectors and normalizes them", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ embedding: { values: [3, 4, ...Array(1534).fill(0)] } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const vector = await embedding("careful about details");
    expect(vector).toHaveLength(1536);
    expect(vector.slice(0, 2)).toEqual([0.6, 0.8]);
    const [url, options] = fetchMock.mock.calls[0] as any;
    expect(url).toContain("models/gemini-embedding-2:embedContent");
    expect(options.headers["x-goog-api-key"]).toBe("google-test-key");
    expect(JSON.parse(options.body)).toEqual({
      content: { parts: [{ text: "careful about details" }] },
      outputDimensionality: 1536,
    });
  });
  it("rejects wrong-size and zero vectors", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ embedding: { values: [1, 2] } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(embedding("word")).rejects.toThrow("could not process");
    fetchMock.mockImplementation(async () =>
      Response.json({ embedding: { values: Array(1536).fill(0) } }),
    );
    await expect(embedding("word")).rejects.toThrow("could not process");
  });
  it("returns text fallback on Google's quota error without exposing the provider payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              status: "RESOURCE_EXHAUSTED",
              message: "private provider detail",
            },
          },
          { status: 429 },
        ),
      ),
    );
    await expect(aiRequest("chat/completions", {})).rejects.toThrow(
      "Google's AI request limit",
    );
    expect(await optionalEmbedding("a private query")).toBeNull();
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(
      "private",
    );
  });
  it("does not silently fall back to a paid provider when Google is unconfigured", async () => {
    secrets.AI_PROVIDER = "gemini";
    delete secrets.GEMINI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await optionalEmbedding("word")).toBeNull();
    await expect(aiRequest("chat/completions", {})).rejects.toThrow(
      "GEMINI_API_KEY",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("rebuilds an old model's vectors and skips already current vectors", async () => {
    const content =
      "miser — noun\nA person who hoards money.\nA person who hoards money.";
    let oldModel = "legacy";
    const upsert = vi.fn(async () => ({ data: null, error: null }));
    const query: any = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({
        data: { content, model: oldModel },
        error: null,
      }),
      upsert,
    };
    const db: any = {
      from: (table: string) =>
        table === "word_senses"
          ? {
              select: () => ({
                eq: async () => ({
                  data: [
                    {
                      id: "sense",
                      part_of_speech: "noun",
                      definition: "A person who hoards money.",
                      simple_definition: "A person who hoards money.",
                      words: { word: "miser" },
                    },
                  ],
                  error: null,
                }),
              }),
            }
          : query,
    };
    const fetchMock = vi.fn(async () =>
      Response.json({ embedding: { values: [1, ...Array(1535).fill(0)] } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await indexWord(db, "word")).toBe(true);
    expect(upsert.mock.calls[0][0]).toMatchObject({
      model: embeddingSpace(),
      content,
    });
    oldModel = embeddingSpace();
    expect(await indexWord(db, "word")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
