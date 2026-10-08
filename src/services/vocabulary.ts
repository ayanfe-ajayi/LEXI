import { supabase } from "../lib/supabase";
import { checked, invoke } from "../lib/api";
import type { Entry, Snapshot, Status } from "../types";
async function collect<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const value = checked(await page(from, from + 499)) || [];
    rows.push(...value);
    if (value.length < 500) break;
  }
  return rows;
}
export async function loadSnapshot(user: string): Promise<Snapshot> {
  const [words, progress, reviews, profile, preferences] = await Promise.all([
    collect((from, to) =>
      supabase
        .from("user_words")
        .select("*,words(*,word_senses(*,word_examples(*)),pronunciations(*))")
        .eq("user_id", user)
        .order("discovered_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    collect((from, to) =>
      supabase
        .from("user_sense_progress")
        .select("*")
        .eq("user_id", user)
        .order("id")
        .range(from, to),
    ),
    collect((from, to) =>
      supabase
        .from("review_events")
        .select("id,sense_id,review_type,result,answer,feedback,created_at")
        .eq("user_id", user)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    supabase.from("profiles").select("*").eq("id", user).maybeSingle(),
    supabase
      .from("reminder_preferences")
      .select("*")
      .eq("user_id", user)
      .maybeSingle(),
  ]);
  return {
    words,
    progress,
    reviews,
    profile: checked(profile),
    preferences: checked(preferences),
    cached_at: new Date().toISOString(),
  } as Snapshot;
}
export async function analyzeWord(word: string) {
  return (
    await invoke<{ entry: Entry }>("vocabulary", { action: "analyze", word })
  ).entry;
}
export async function saveWord(
  word: string,
  note: string,
  source: string,
  context: string,
) {
  return invoke<{ word_id: string; indexed: boolean }>("vocabulary", {
    action: "save",
    word,
    note,
    source,
    context,
  });
}
export async function updateWord(
  user: string,
  id: string,
  patch: {
    status?: Status;
    personal_note?: string;
    source?: string;
    encounter_context?: string;
  },
) {
  checked(
    await supabase
      .from("user_words")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user),
  );
}
export async function deleteWord(word_id: string) {
  return invoke("vocabulary", { action: "delete", word_id });
}
