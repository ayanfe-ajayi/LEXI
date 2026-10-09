import { beforeEach, describe, expect, it, vi } from "vitest";
const S = "11111111-1111-4111-8111-111111111111";
const U = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({
  handler: null as any,
  db: { rpc: vi.fn(), from: vi.fn() },
  optionalEmbedding: vi.fn(),
  structured: vi.fn(),
  lookup: vi.fn(),
  available: true,
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
  aiAvailable: () => mocks.available,
  optionalEmbedding: mocks.optionalEmbedding,
  embeddingSpace: () => "google:gemini-embedding-2:1536",
  structured: mocks.structured,
}));
vi.mock("../supabase/functions/_shared/dictionary.ts", () => ({
  lookup: mocks.lookup,
}));
import { AppError } from "../supabase/functions/_shared/http.ts";
import "../supabase/functions/reverse-search/index.ts";
const saved = {
  sense_id: S,
  word_id: "saved",
  word: "miser",
  part_of_speech: "noun",
  definition: "A person who hoards money.",
  simple_definition: "A person who hoards money.",
  in_vocabulary: true,
  discovered_at: null,
  score: 0.35,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.structured.mockReset();
  mocks.available = true;
  mocks.db.rpc.mockResolvedValue({ data: [saved], error: null });
  mocks.optionalEmbedding.mockResolvedValue([1]);
  mocks.lookup.mockResolvedValue({});
  const lexical: any = {
    select: vi.fn(() => lexical),
    eq: vi.fn(() => lexical),
    in: vi.fn(async () => ({
      data: [
        {
          id: "new",
          word: "surreptitious",
          word_senses: [
            {
              id: U,
              part_of_speech: "adjective",
              definition: "Done secretly to avoid notice.",
              simple_definition: "Done secretly.",
            },
          ],
        },
      ],
      error: null,
    })),
  };
  const owned: any = {
    select: vi.fn(() => owned),
    eq: vi.fn(() => owned),
    neq: vi.fn(() => owned),
    in: vi.fn(async () => ({ data: [], error: null })),
  };
  mocks.db.from.mockImplementation((table) =>
    table === "words" ? lexical : owned,
  );
});
const request = (mine = true, query = "hoards money") =>
  new Request("https://lexi.test", {
    method: "POST",
    body: JSON.stringify({ query, mine }),
  });
describe("reverse meaning search", () => {
  it("identifies a missing database upgrade", async () => {
    mocks.db.rpc.mockResolvedValue({
      data: null,
      error: {
        message: "Could not find public.hybrid_search_v2 in the schema cache",
      },
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(mocks.handler(request())).rejects.toThrow(
      "Run gemini-upgrade.sql",
    );
    error.mockRestore();
  });
  it("filters irrelevant saved words instead of always returning the nearest ones", async () => {
    mocks.structured.mockResolvedValue({
      matches: [],
      explanation: "None fits this description.",
    });
    const result = await mocks.handler(request(true, "done secretly"));
    expect(result.results).toEqual([]);
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.db.rpc.mock.calls[0][1].p_mine).toBe(true);
  });
  it("finds dictionary-verified words outside the collection when mine is unchecked", async () => {
    mocks.structured
      .mockResolvedValueOnce({ words: ["surreptitious"] })
      .mockResolvedValueOnce({
        matches: [{ sense_id: U, confidence: "strong" }],
        explanation: "Surreptitious means done secretly.",
      });
    const result = await mocks.handler(request(false, "done secretly"));
    expect(mocks.lookup).toHaveBeenCalledWith(mocks.db, "surreptitious", {
      enrich: false,
    });
    expect(result.results.map((r: any) => r.word)).toEqual(["surreptitious"]);
    expect(result.results[0].in_vocabulary).toBe(false);
    expect(result.mode).toBe("discovery");
    const personal = mocks.db.from.mock.results.find(
      (r: any, i: number) => mocks.db.from.mock.calls[i][0] === "user_words",
    )!.value;
    expect(personal.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(
      mocks.db.rpc.mock.calls.some((c) => c[0] === "save_lexical_word"),
    ).toBe(false);
  });
  it("rejects AI-invented senses and never shows unverified suggestions", async () => {
    mocks.lookup.mockRejectedValue(new AppError(404, "Not in dictionary"));
    mocks.structured
      .mockResolvedValueOnce({ words: ["imaginaryword"] })
      .mockResolvedValueOnce({
        matches: [{ sense_id: U, confidence: "strong" }],
        explanation: "Invented answer",
      });
    const result = await mocks.handler(request(false));
    expect(result.results).toEqual([]);
    expect(result.explanation).toBe("");
    expect(result.notice).toContain("could not be checked");
    expect(mocks.db.from).not.toHaveBeenCalled();
  });
  it("falls back to text matches rather than loose vector neighbours if ranking fails", async () => {
    mocks.db.rpc
      .mockResolvedValueOnce({ data: [saved], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    mocks.structured.mockRejectedValue(new AppError(429, "Quota reached"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await mocks.handler(request());
    expect(result.results).toEqual([]);
    expect(result.mode).toBe("text");
    expect(mocks.db.rpc.mock.calls[1][1].p_embedding).toBeNull();
    expect(result.notice).toContain("temporarily unavailable");
    warn.mockRestore();
  });
  it("clearly reports limited coverage when broader AI discovery fails", async () => {
    mocks.optionalEmbedding.mockResolvedValue(null);
    mocks.structured
      .mockRejectedValueOnce(new AppError(429, "Quota reached"))
      .mockResolvedValueOnce({
        matches: [{ sense_id: S, confidence: "strong" }],
        explanation: "Miser fits.",
      });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await mocks.handler(request(false));
    expect(result.results[0].word).toBe("miser");
    expect(result.notice).toContain("already looked up");
    warn.mockRestore();
  });
  it("deduplicates senses and follows meaning relevance rather than saved-first ranking", async () => {
    mocks.db.rpc.mockResolvedValue({
      data: [saved, { ...saved, sense_id: U }],
      error: null,
    });
    mocks.structured.mockResolvedValue({
      matches: [
        { sense_id: U, confidence: "strong" },
        { sense_id: S, confidence: "approximate" },
      ],
      explanation: "Miser fits.",
    });
    const result = await mocks.handler(request());
    expect(result.results).toHaveLength(1);
    expect(result.results[0].sense_id).toBe(U);
  });
});
