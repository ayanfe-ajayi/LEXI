import { describe, it, expect } from "vitest";
import {
  nextInterval,
  normalizeAnswer,
  makeQuestions,
} from "../src/services/review";
import { learningStats } from "../src/lib/utils";
import type { Snapshot, UserWord } from "../src/types";
const word = (name: string, id: string): UserWord => ({
  id,
  user_id: "learner",
  word_id: id,
  status: "learning",
  personal_note: "",
  source: "Book",
  encounter_context: "",
  discovered_at: new Date().toISOString(),
  words: {
    id,
    word: name,
    pronunciations: [],
    word_senses: [
      {
        id: `sense-${id}`,
        word_id: id,
        part_of_speech: "adjective",
        definition: `Meaning of ${name}`,
        simple_definition: `Simple ${name}`,
        usage_note: "",
        register: "neutral",
        difficulty: "advanced",
        synonyms: [],
        phrases: [],
        lexical_source: "test",
        source_url: null,
        source_license: null,
        ai_enriched: false,
        word_examples: [],
      },
    ],
  },
});
const data: Snapshot = {
  words: [word("meticulous", "one"), word("cumbersome", "two")],
  progress: [],
  reviews: [],
  profile: null,
  preferences: null,
  cached_at: "",
};
describe("learning rules and questions", () => {
  it("advances a successful review and caps at sixty days", () => {
    expect(nextInterval(0, true)).toEqual({ index: 1, days: 3 });
    expect(nextInterval(5, true)).toEqual({ index: 5, days: 60 });
  });
  it("resets forgotten words to one day", () => {
    expect(nextInterval(4, false)).toEqual({ index: 0, days: 1 });
  });
  it("accepts punctuation and case differences without accepting another word", () => {
    expect(normalizeAnswer(" Meticulous! ")).toBe("meticulous");
    expect(normalizeAnswer("meticulous work")).not.toBe("meticulous");
  });
  it("excludes archived words from practice", () => {
    expect(
      makeQuestions(
        { ...data, words: [{ ...data.words[0], status: "archived" }] },
        "quiz",
      ),
    ).toHaveLength(0);
  });
  it("does not offer a recognition exercise with only one answer", () => {
    expect(
      makeQuestions({ ...data, words: [data.words[0]] }, "quiz")[0].type,
    ).toBe("reverse_recall");
  });
  it("produces unique choices and separate sense questions", () => {
    const questions = makeQuestions(data, "quiz");
    expect(questions).toHaveLength(2);
    expect(new Set(questions[0].choices).size).toBe(
      questions[0].choices?.length,
    );
  });
  it("keeps empty-user metrics real rather than prepopulating progress", () => {
    expect(learningStats({ ...data, words: [] })).toMatchObject({
      saved: 0,
      mastered: 0,
      streak: 0,
      accuracy: 0,
    });
  });
});
