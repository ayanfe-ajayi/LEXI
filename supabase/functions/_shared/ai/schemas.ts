import { z } from "zod";
export const senseSchema = z.object({
  part_of_speech: z.string().min(1).max(40),
  definition: z.string().min(1).max(2000),
  simple_definition: z.string().min(1).max(1000),
  usage_note: z.string().max(1000),
  register: z.string().max(60),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  synonyms: z.array(z.string().max(80)).max(12),
  phrases: z.array(z.string().max(160)).max(10),
  examples: z
    .array(
      z.object({
        sentence: z.string().min(1).max(1000),
        source: z.string().max(80),
      }),
    )
    .max(6),
  lexical_source: z.string().max(100),
  source_url: z.string().nullable(),
  source_license: z.string().nullable(),
  ai_enriched: z.boolean(),
});
export const entrySchema = z.object({
  word: z.string().min(1).max(80),
  senses: z.array(senseSchema).min(1).max(12),
  pronunciations: z
    .array(
      z.object({
        accent: z.string().max(50),
        ipa: z.string().max(120),
        audio_url: z.string().url().nullable(),
      }),
    )
    .max(8),
});
export type Entry = z.infer<typeof entrySchema>;
export const assessmentSchema = z.object({
  correct: z.boolean(),
  feedback: z.string().min(1).max(1500),
});
export const tutorSchema = z.object({
  message: z.string().min(1).max(6000),
  suggestions: z.array(z.string().max(200)).max(4),
  exercise: z
    .object({
      sense_id: z.string().uuid(),
      word: z.string().max(80),
      question: z.string().max(1000),
      type: z.enum(["usage", "active_recall", "reverse_recall"]),
    })
    .nullable(),
});
export const enrichmentSchema = z.object({
  senses: z
    .array(
      z.object({
        simple_definition: z.string().min(1).max(1000),
        usage_note: z.string().max(1000),
        register: z.string().max(60),
        difficulty: z.enum(["beginner", "intermediate", "advanced"]),
        phrases: z.array(z.string().max(160)).max(6),
        example: z.string().max(1000),
      }),
    )
    .min(1)
    .max(12),
});
