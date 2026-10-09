import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookup } from "../supabase/functions/_shared/dictionary";
import {
  aiAvailable,
  aiRequest,
  structured,
} from "../supabase/functions/_shared/ai/client";

vi.mock("../supabase/functions/_shared/ai/client", async (original) => ({
  ...(await original<
    typeof import("../supabase/functions/_shared/ai/client")
  >()),
  aiAvailable: vi.fn(() => false),
  structured: vi.fn(),
}));

const dictionaryEntry = [
  {
    word: "hello",
    phonetics: [],
    meanings: [
      {
        partOfSpeech: "noun",
        definitions: [
          { definition: "A greeting.", example: "She said hello." },
        ],
      },
    ],
  },
];
const fallbackEntry = {
  word: "miser",
  entries: [
    {
      language: { code: "en" },
      partOfSpeech: "noun",
      pronunciations: [{ type: "ipa", text: "/ˈmaɪzə/" }],
      synonyms: ["skinflint"],
      senses: [
        {
          definition: "A person who hoards money.",
          examples: ["The miser kept his coins."],
          synonyms: [],
        },
      ],
    },
  ],
  source: {
    url: "https://en.wiktionary.org/wiki/miser",
    license: {
      name: "CC BY-SA 4.0",
      url: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
};
const helloEntry = {
  ...fallbackEntry,
  word: "hello",
  entries: [
    {
      ...fallbackEntry.entries[0],
      senses: [
        {
          definition: "A greeting.",
          examples: ["She said hello."],
          synonyms: [],
        },
      ],
    },
  ],
};
function database() {
  const query: any = {};
  for (const method of ["select", "eq"]) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  return {
    from: vi.fn(() => query),
    rpc: vi.fn(async () => ({ data: "word-id", error: null })),
  };
}

beforeEach(() => {
  vi.mocked(aiAvailable).mockReturnValue(false);
  vi.mocked(structured).mockReset();
  vi.stubGlobal("Deno", {
    env: {
      get: (name: string) => (name === "AI_API_KEY" ? "test-key" : undefined),
    },
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("dictionary lookup resilience", () => {
  it("verifies reverse-search suggestions without spending another AI enrichment request", async () => {
    vi.mocked(aiAvailable).mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(fallbackEntry)),
    );
    const entry = await lookup(database() as any, "miser", { enrich: false });
    expect(entry.senses[0].ai_enriched).toBe(false);
    expect(vi.mocked(structured)).not.toHaveBeenCalled();
  });
  it("uses the working Wiktionary provider immediately without calling the slow provider", async () => {
    const fetchMock = vi.fn(async () => Response.json(fallbackEntry));
    vi.stubGlobal("fetch", fetchMock);
    const entry = await lookup(database() as any, "miser");
    expect(entry.senses[0]).toMatchObject({
      definition: "A person who hoards money.",
      synonyms: ["skinflint"],
      lexical_source: "FreeDictionaryAPI.com (Wiktionary)",
      source_url: fallbackEntry.source.url,
    });
    expect(entry.pronunciations[0].ipa).toBe("/ˈmaɪzə/");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://freedictionaryapi.com/api/v1/entries/en/miser",
    );
  });
  it("preserves and caches dictionary definitions when optional AI fails", async () => {
    vi.mocked(aiAvailable).mockReturnValue(true);
    vi.mocked(structured).mockRejectedValue(new Error("No credits"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(helloEntry)),
    );
    const db = database();
    const entry = await lookup(db as any, "hello");
    expect(entry.senses[0]).toMatchObject({
      simple_definition: "A greeting.",
      ai_enriched: false,
    });
    expect(db.rpc).toHaveBeenCalledWith(
      "save_lexical_word",
      expect.objectContaining({ p_entry: entry, p_user: null }),
    );
  });
  it("rejects incomplete AI sense lists while retaining dictionary definitions", async () => {
    vi.mocked(aiAvailable).mockReturnValue(true);
    vi.mocked(structured).mockResolvedValue({ senses: [] });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(helloEntry)),
    );
    const entry = await lookup(database() as any, "hello");
    expect(entry.senses[0].ai_enriched).toBe(false);
  });
  it("uses the second provider after a transport failure and preserves attribution", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network failure"))
      .mockResolvedValueOnce(Response.json(dictionaryEntry));
    vi.stubGlobal("fetch", fetchMock);
    const entry = await lookup(database() as any, "hello");
    expect(entry.senses[0]).toMatchObject({
      definition: "A greeting.",
      lexical_source: "Free Dictionary API",
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.dictionaryapi.dev/api/v2/entries/en/hello",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("uses the second provider after temporary HTTP failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(Response.json(dictionaryEntry));
    vi.stubGlobal("fetch", fetchMock);
    await lookup(database() as any, "hello");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("checks both dictionaries before reporting a missing word and never invents entries", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const db = database();
    await expect(lookup(db as any, "missing")).rejects.toMatchObject({
      status: 404,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("stops after two connection failures and does not save", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    vi.stubGlobal("fetch", fetchMock);
    const db = database();
    await expect(lookup(db as any, "hello")).rejects.toMatchObject({
      status: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(db.rpc).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith("Dictionary connection failed", {
      attempt: 2,
      provider: "dictionaryapi.dev",
      reason: "timeout",
    });
  });
  it("tries the fallback when the first dictionary does not contain a word", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("", { status: 404 }))
        .mockResolvedValueOnce(Response.json(dictionaryEntry)),
    );
    expect(
      (await lookup(database() as any, "hello")).senses[0].definition,
    ).toBe("A greeting.");
  });
  it("does not cache malformed responses from either provider", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ unexpected: true })),
    );
    const db = database();
    await expect(lookup(db as any, "miser")).rejects.toMatchObject({
      status: 503,
    });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("handles fallback entries with no English results without creating a word", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ ...fallbackEntry, entries: [] }))
        .mockResolvedValueOnce(new Response("", { status: 404 })),
    );
    const db = database();
    await expect(lookup(db as any, "missing")).rejects.toMatchObject({
      status: 404,
    });
    expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe("AI provider errors", () => {
  it.each(["insufficient_quota", "credit_balance_exhausted"])(
    "identifies billing error %s",
    async (code) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => Response.json({ error: { code } }, { status: 429 })),
      );
      await expect(aiRequest("chat/completions", {})).rejects.toThrow(
        "no available credits",
      );
    },
  );
  it("keeps genuine rate limits separate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: { code: "rate_limit_exceeded" } },
          { status: 429 },
        ),
      ),
    );
    await expect(aiRequest("chat/completions", {})).rejects.toThrow("busy");
  });
});
