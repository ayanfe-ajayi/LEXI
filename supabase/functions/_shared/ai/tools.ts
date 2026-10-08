import { z } from "zod";
import { type Admin, check, AppError } from "../http.ts";
import { embedding } from "./client.ts";
import { lookup } from "../dictionary.ts";
const toolNames = {
  search_my_vocabulary:
    "Find saved words by spelling, source, or personal note.",
  get_word:
    "Get dictionary senses, examples and pronunciations for a word, with saved status.",
  get_word_history:
    "Get a saved word’s sense scores and its last 12 review attempts.",
  search_word_meaning:
    "Find saved or canonical word senses by a description of their meaning.",
  semantic_search_vocabulary: "Find the user’s saved vocabulary by meaning.",
  get_words_due_for_review: "Retrieve up to 12 active word senses due now.",
  get_weak_words:
    "Retrieve up to 12 word senses with weakest recall and previous failures.",
  get_recently_learned_words: "Retrieve the 12 most recently saved words.",
  analyze_sentence:
    "Retrieve the relevant word senses to explain or correct a sentence.",
  generate_quiz:
    "Retrieve up to 6 saved word senses to generate practice questions.",
  create_learning_note:
    "Save a personal note on a saved word, only if the user explicitly asks to save a note.",
};
export const tools = Object.entries(toolNames).map(([name, description]) => ({
  type: "function",
  function: {
    name,
    description,
    strict: true,
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        note: { type: ["string", "null"] },
      },
      required: ["query", "note"],
      additionalProperties: false,
    },
  },
}));
export async function executeTool(
  db: Admin,
  user: string,
  name: string,
  raw: unknown,
) {
  const { query, note } = z
    .object({
      query: z.string().max(500),
      note: z.string().max(2000).nullable(),
    })
    .parse(raw);
  const normalized = query
    .toLowerCase()
    .trim()
    .replace(/[%_,()]/g, "");
  const personal = () =>
    db
      .from("user_words")
      .select(
        "word_id,status,personal_note,source,encounter_context,discovered_at,words!inner(word,word_senses(*,word_examples(*)),pronunciations(*))",
      )
      .eq("user_id", user)
      .neq("status", "archived");
  switch (name) {
    case "search_my_vocabulary":
      return check(
        await personal()
          .ilike("words.normalized_word", `%${normalized}%`)
          .limit(12),
      );
    case "get_recently_learned_words":
      return check(
        await personal().order("discovered_at", { ascending: false }).limit(12),
      );
    case "get_word": {
      const saved = check(
        await personal().eq("words.normalized_word", normalized).maybeSingle(),
      );
      return saved || (await lookup(db, normalized));
    }
    case "get_word_history": {
      const word = check(
        await personal().eq("words.normalized_word", normalized).maybeSingle(),
      );
      if (!word) return { message: "This word has not been saved." };
      const ids = (word.words as any).word_senses.map((s: any) => s.id);
      return {
        word,
        progress: check(
          await db
            .from("user_sense_progress")
            .select("*")
            .eq("user_id", user)
            .in("sense_id", ids),
        ),
        reviews: check(
          await db
            .from("review_events")
            .select("review_type,result,answer,feedback,created_at")
            .eq("user_id", user)
            .in("sense_id", ids)
            .order("created_at", { ascending: false })
            .limit(12),
        ),
      };
    }
    case "search_word_meaning":
    case "semantic_search_vocabulary": {
      const vector = await embedding(query);
      return check(
        await db.rpc("hybrid_search", {
          p_user: user,
          p_query: query,
          p_embedding: vector,
          p_mine: name === "semantic_search_vocabulary",
        }),
      );
    }
    case "get_words_due_for_review":
    case "get_weak_words":
    case "generate_quiz": {
      const base = db
        .from("user_sense_progress")
        .select(
          "*,word_senses!inner(*,words!inner(word,user_words!inner(user_id,status)))",
        )
        .eq("user_id", user)
        .eq("word_senses.words.user_words.user_id", user)
        .neq("word_senses.words.user_words.status", "archived");
      if (name === "get_words_due_for_review")
        return check(
          await base
            .lte("next_review_at", new Date().toISOString())
            .order("next_review_at")
            .limit(12),
        );
      if (name === "get_weak_words")
        return check(
          await base
            .order("recall_score")
            .order("times_forgotten", { ascending: false })
            .limit(12),
        );
      return check(
        await base.order("last_reviewed_at", { nullsFirst: true }).limit(6),
      );
    }
    case "analyze_sentence":
      return check(
        await personal().eq("words.normalized_word", normalized).limit(1),
      );
    case "create_learning_note": {
      if (!note) throw new AppError(400, "A note is required.");
      const word = check(
        await personal().eq("words.normalized_word", normalized).maybeSingle(),
      );
      if (!word) return { message: "Save this word before adding a note." };
      check(
        await db
          .from("user_words")
          .update({ personal_note: note })
          .eq("user_id", user)
          .eq("word_id", word.word_id),
      );
      return { saved: true, word: query, note };
    }
    default:
      throw new AppError(400, "Unknown tutor tool.");
  }
}
