import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  handler: null as any,
  db: { rpc: vi.fn() },
  optionalEmbedding: vi.fn(),
  structured: vi.fn(),
}));
vi.mock("../supabase/functions/_shared/http.ts", async (original) => ({
  ...(await original<any>()),
  serve: (handler: any) => {
    mocks.handler = handler;
  },
  requireUser: async () => ({ db: mocks.db, user: { id: "owner" } }),
  quota: async () => {},
}));
vi.mock("../supabase/functions/_shared/ai/client.ts", () => ({
  aiAvailable: () => true,
  optionalEmbedding: mocks.optionalEmbedding,
  embeddingSpace: () => "google:gemini-embedding-2:1536",
  structured: mocks.structured,
}));
import { AppError } from "../supabase/functions/_shared/http.ts";
import "../supabase/functions/reverse-search/index.ts";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.db.rpc.mockResolvedValue({ data: [{ word: "miser" }], error: null });
});
const request = () =>
  new Request("https://lexi.test", {
    method: "POST",
    body: JSON.stringify({ query: "hoards money", mine: true }),
  });
describe("meaning search resilience", () => {
  it("identifies a missing database upgrade instead of returning a vague failure", async () => {
    mocks.optionalEmbedding.mockResolvedValue(null);
    mocks.db.rpc.mockResolvedValue({
      data: null,
      error: {
        message:
          "Could not find the function public.hybrid_search_v2 in the schema cache",
      },
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(mocks.handler(request())).rejects.toThrow(
      "Run gemini-upgrade.sql",
    );
    error.mockRestore();
  });
  it("returns real text matches when semantic embedding is unavailable", async () => {
    mocks.optionalEmbedding.mockResolvedValue(null);
    const result = await mocks.handler(request());
    expect(result).toEqual({
      results: [{ word: "miser" }],
      explanation: "",
      mode: "text",
    });
    expect(mocks.db.rpc).toHaveBeenCalledWith("hybrid_search_v2", {
      p_user: "owner",
      p_query: "hoards money",
      p_embedding: null,
      p_mine: true,
      p_embedding_model: null,
    });
    expect(mocks.structured).not.toHaveBeenCalled();
  });
  it("preserves hybrid results when only the explanation hits its quota", async () => {
    mocks.optionalEmbedding.mockResolvedValue([1]);
    mocks.structured.mockRejectedValue(new AppError(429, "Quota reached"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await mocks.handler(request());
    expect(result.mode).toBe("hybrid");
    expect(result.results).toEqual([{ word: "miser" }]);
    expect(mocks.db.rpc.mock.calls[0][1].p_embedding_model).toBe(
      "google:gemini-embedding-2:1536",
    );
    warn.mockRestore();
  });
});
