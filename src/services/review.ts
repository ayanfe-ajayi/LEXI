import type {
  Question,
  ReviewType,
  Snapshot,
  UserWord,
  ReviewSubmission,
  ReviewResult,
} from "../types";
import { invoke } from "../lib/api";
export const intervals = [1, 3, 7, 14, 30, 60] as const;
export function nextInterval(index: number, correct: boolean) {
  const step = correct ? Math.min(index + 1, 5) : 0;
  return { index: step, days: intervals[step] };
}
export function normalizeAnswer(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.!?,;:]+$/, "")
    .replace(/\s+/g, " ");
}
export function makeQuestions(
  data: Snapshot,
  mode: "due" | "quiz",
  wordId?: string,
): Question[] {
  const active = data.words.filter(
    (w) => w.status !== "archived" && (!wordId || w.word_id === wordId),
  );
  const items = active.flatMap((word) =>
    word.words.word_senses.map((sense) => ({
      word,
      sense,
      progress: data.progress.find((p) => p.sense_id === sense.id),
    })),
  );
  const due = items.filter(
    (i) =>
      mode === "quiz" ||
      wordId ||
      !i.progress ||
      new Date(i.progress.next_review_at).getTime() <= Date.now(),
  );
  due.sort((a, b) =>
    (a.progress?.next_review_at || "").localeCompare(
      b.progress?.next_review_at || "",
    ),
  );
  return due.slice(0, data.preferences?.daily_limit || 10).map((item, i) => {
    const { sense, word } = item;
    const types: ReviewType[] = [
      "recognition",
      "reverse_recall",
      "active_recall",
      "fill_blank",
      "usage",
    ];
    let type = types[i % types.length];
    const target = new RegExp("\\b" + word.words.word + "\\b", "i");
    const example = sense.word_examples.find((e) => target.test(e.sentence));
    if (type === "fill_blank" && !example) type = "reverse_recall";
    const distractors = data.words
      .flatMap((w) => w.words.word_senses)
      .filter((s) => s.id !== sense.id && s.definition !== sense.definition)
      .map((s) => s.definition);
    const choices = [sense.definition, ...new Set(distractors)].slice(0, 4);
    if (type === "recognition" && choices.length < 2) type = "reverse_recall";
    // Stable rotation without duplicate choices or an always-first answer.
    if (choices.length > 1)
      choices.push(
        ...choices.splice(0, (sense.definition.length + i) % choices.length),
      );
    const sentence = example?.sentence.replace(
      new RegExp(target.source, "gi"),
      "________",
    );
    const prompt =
      type === "reverse_recall"
        ? sense.simple_definition
        : type === "fill_blank"
          ? sentence || ""
          : type === "usage"
            ? `Use “${word.words.word}” in a sentence.`
            : `What does “${word.words.word}” mean?`;
    return {
      word,
      sense,
      type,
      prompt,
      choices: type === "recognition" ? choices : undefined,
      sentence,
    };
  });
}
export function practicePronunciation(word: UserWord): Question {
  const sense = word.words.word_senses[0];
  return {
    word,
    sense,
    type: "pronunciation",
    prompt: `Say “${word.words.word}” aloud.`,
  };
}
export function submitReview(input: ReviewSubmission, expectedUser?: string) {
  return invoke<ReviewResult>("review", input, expectedUser);
}
