import { z } from "zod";
import {
  serve,
  body,
  requireUser,
  quota,
  check,
  AppError,
} from "../_shared/http.ts";
import { entrySchema } from "../_shared/ai/schemas.ts";
import { lookup, indexWord } from "../_shared/dictionary.ts";
const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("analyze"),
    word: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-zA-Z][a-zA-Z '\-]*$/),
  }),
  z.object({
    action: z.literal("save"),
    word: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-zA-Z][a-zA-Z '\-]*$/),
    note: z.string().max(2000).default(""),
    source: z.string().max(120).default(""),
    context: z.string().max(2000).default(""),
  }),
  z.object({ action: z.literal("delete"), word_id: z.string().uuid() }),
  z.object({ action: z.literal("index"), word_id: z.string().uuid() }),
]);
serve(async (req) => {
  const { db, user } = await requireUser(req);
  const data = input.parse(await body(req));
  await quota(db, user.id);
  if (data.action === "delete") {
    // Erase the user's progress/history/association atomically, preserving shared lexical data.
    check(
      await db.rpc("delete_user_word", {
        p_user: user.id,
        p_word: data.word_id,
      }),
    );
    return { deleted: true };
  }
  if (data.action === "index") {
    const owned = check(
      await db
        .from("user_words")
        .select("id")
        .eq("user_id", user.id)
        .eq("word_id", data.word_id)
        .maybeSingle(),
    );
    if (!owned) throw new AppError(404, "This word is not in your vocabulary.");
    return { indexed: await indexWord(db, data.word_id) };
  }
  const word = data.word.toLowerCase().replace(/\s+/g, " ");
  const entry = entrySchema.parse(await lookup(db, word));
  if (data.action === "analyze") return { entry };
  const word_id = check(
    await db.rpc("save_lexical_word", {
      p_user: user.id,
      p_entry: entry,
      p_note: data.note,
      p_source: data.source,
      p_context: data.context,
    }),
  );
  let indexed = false;
  try {
    indexed = await indexWord(db, word_id);
  } catch (e) {
    console.error(
      "Embedding deferred:",
      e instanceof Error ? e.message : "Unknown",
    );
  }
  return { word_id, indexed };
});
