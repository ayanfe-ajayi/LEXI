import type { Page } from "@playwright/test";
const USER = "11111111-1111-4111-8111-111111111111";
export const wordIds = [
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
];
export const senseIds = [
  "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  "bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb",
  "cccccccc-1111-4111-8111-cccccccccccc",
];
export const definitions = [
  "Very careful about details.",
  "Awkward or difficult to handle.",
  "Doing something without intending to.",
];
export const names = ["meticulous", "cumbersome", "inadvertently"];
const user = {
  id: USER,
  email: "learner@example.com",
  aud: "authenticated",
  role: "authenticated",
  created_at: new Date().toISOString(),
  user_metadata: { display_name: "Alex" },
  app_metadata: { provider: "email" },
};
function fixtures(pronunciation?: {
  accent: string;
  ipa: string;
  audio_url: string | null;
}) {
  const words = names.map((word, i) => ({
    id: `user-${i}`,
    user_id: USER,
    word_id: wordIds[i],
    status: i === 2 ? "mastered" : "learning",
    personal_note: i === 0 ? "A careful editor" : "",
    source: "Movie or TV",
    encounter_context: "A word from a film.",
    discovered_at: new Date(Date.now() - i * 86400000).toISOString(),
    words: {
      id: wordIds[i],
      word,
      pronunciations: [
        pronunciation || { accent: "English", ipa: "/test/", audio_url: null },
      ],
      word_senses: [
        {
          id: senseIds[i],
          word_id: wordIds[i],
          part_of_speech: i === 2 ? "adverb" : "adjective",
          definition: definitions[i],
          simple_definition: definitions[i],
          usage_note: "Use it to describe your experience.",
          register: "neutral",
          difficulty: "advanced",
          synonyms: [],
          phrases: [],
          lexical_source: "Test dictionary",
          source_url: null,
          source_license: null,
          ai_enriched: false,
          word_examples: [
            { sentence: `The task was ${word}.`, source: "Test dictionary" },
          ],
        },
      ],
    },
  }));
  const progress = names.map((_w, i) => ({
    id: `progress-${i}`,
    user_id: USER,
    sense_id: senseIds[i],
    understanding_score: 80,
    recall_score: i === 0 ? 40 : 80,
    usage_score: 40,
    pronunciation_score: 0,
    times_reviewed: 4,
    times_forgotten: i === 0 ? 2 : 0,
    times_correct: 2,
    times_used: 0,
    interval_index: 1,
    last_reviewed_at: new Date(Date.now() - 86400000).toISOString(),
    next_review_at: new Date(Date.now() - 3600000).toISOString(),
  }));
  return { words, progress };
}
export async function signedIn(
  page: Page,
  pronunciation?: { accent: string; ipa: string; audio_url: string | null },
) {
  const { words, progress } = fixtures(pronunciation);
  await page.addInitScript(
    ({ user }) => {
      localStorage.setItem(
        "sb-pgxbzcsplpjtbvmtifta-auth-token",
        JSON.stringify({
          access_token: "test-token",
          refresh_token: "test-refresh",
          expires_in: 3600,
          expires_at:
            Math.floor(Date.now() / 1000) + (navigator.onLine ? 3600 : -120),
          token_type: "bearer",
          user,
        }),
      );
    },
    { user },
  );
  await page.route(
    "https://pgxbzcsplpjtbvmtifta.supabase.co/**",
    async (route) => {
      const url = new URL(route.request().url());
      const table = url.pathname.split("/").pop();
      if (url.pathname.includes("/auth/v1/token")) {
        await route.abort("internetdisconnected");
        return;
      }
      let body: unknown = [];
      if (url.pathname.includes("/auth/v1/user")) body = user;
      else if (table === "user_words") body = words;
      else if (table === "user_sense_progress") body = progress;
      else if (table === "review_events")
        body = [
          {
            id: "review-1",
            sense_id: senseIds[0],
            review_type: "reverse_recall",
            result: true,
            answer: "meticulous",
            feedback: "Correct",
            created_at: new Date().toISOString(),
          },
        ];
      else if (table === "profiles")
        body = {
          id: USER,
          display_name: "Alex",
          timezone: "Africa/Lagos",
          avatar_url: null,
        };
      else if (table === "reminder_preferences")
        body = {
          user_id: USER,
          enabled: false,
          preferred_time: "09:00",
          timezone: "Africa/Lagos",
          daily_limit: 10,
          frequency: "daily",
          quiet_start: "22:00",
          quiet_end: "07:00",
        };
      else if (url.pathname.includes("/functions/v1/")) {
        const input = route.request().postDataJSON();
        if (table === "review")
          body = {
            correct:
              input.answer.toLowerCase().replace(/[.!]/g, "") ===
                names[senseIds.indexOf(input.sense_id)] ||
              input.answer === definitions[0],
            feedback: "Nicely recalled. Your next review is scheduled.",
          };
        else if (table === "reverse-search")
          body = {
            results: [
              {
                sense_id: senseIds[2],
                word_id: wordIds[2],
                word: "inadvertently",
                part_of_speech: "adverb",
                definition: definitions[2],
                simple_definition: definitions[2],
                in_vocabulary: true,
                discovered_at: new Date().toISOString(),
                score: 0.9,
              },
            ],
            explanation:
              "Inadvertently describes doing something unintentionally.",
            mode: "hybrid",
          };
        else if (table === "ai")
          body = {
            session_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            message:
              "Let’s practise meticulous. You recognise its meaning but could use some sentence practice.",
            suggestions: ["Give me an example"],
            exercise: {
              sense_id: senseIds[0],
              word: "meticulous",
              question: "Use meticulous in a sentence.",
              type: "usage",
            },
          };
        else if (table === "vocabulary" && input.action === "analyze")
          body = {
            entry: {
              word: "meticulous",
              senses: [
                {
                  ...words[0].words.word_senses[0],
                  examples: words[0].words.word_senses[0].word_examples,
                },
              ],
              pronunciations: [],
            },
          };
        else if (table === "vocabulary")
          body = { word_id: wordIds[0], indexed: true };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    },
  );
}
