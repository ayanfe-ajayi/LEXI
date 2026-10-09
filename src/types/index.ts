export type Status = "new" | "learning" | "reviewing" | "mastered" | "archived";
export type ReviewType =
  | "meaning"
  | "recognition"
  | "active_recall"
  | "fill_blank"
  | "usage"
  | "pronunciation"
  | "reverse_recall";
export interface Example {
  id?: string;
  sentence: string;
  source: string;
}
export interface Sense {
  id: string;
  word_id: string;
  part_of_speech: string;
  definition: string;
  simple_definition: string;
  usage_note: string;
  register: string;
  difficulty: string;
  synonyms: string[];
  phrases: string[];
  lexical_source: string;
  source_url: string | null;
  source_license: string | null;
  ai_enriched: boolean;
  word_examples: Example[];
}
export interface Pronunciation {
  accent: string;
  ipa: string;
  audio_url: string | null;
}
export interface Word {
  id: string;
  word: string;
  word_senses: Sense[];
  pronunciations: Pronunciation[];
}
export interface UserWord {
  id: string;
  user_id: string;
  word_id: string;
  status: Status;
  personal_note: string;
  source: string;
  encounter_context: string;
  discovered_at: string;
  words: Word;
}
export interface Progress {
  id: string;
  sense_id: string;
  understanding_score: number;
  recall_score: number;
  usage_score: number;
  pronunciation_score: number;
  times_reviewed: number;
  times_forgotten: number;
  times_correct: number;
  times_used: number;
  interval_index: number;
  last_reviewed_at: string | null;
  next_review_at: string;
}
export interface ReviewEvent {
  id: string;
  sense_id: string;
  review_type: ReviewType;
  result: boolean;
  answer: string;
  feedback: string;
  created_at: string;
}
export interface Profile {
  id: string;
  display_name: string;
  timezone: string;
  avatar_url: string | null;
}
export interface Preferences {
  user_id: string;
  enabled: boolean;
  preferred_time: string;
  timezone: string;
  daily_limit: number;
  frequency: "daily" | "weekdays";
  quiet_start: string;
  quiet_end: string;
}
export interface Snapshot {
  words: UserWord[];
  progress: Progress[];
  reviews: ReviewEvent[];
  profile: Profile | null;
  preferences: Preferences | null;
  cached_at: string;
}
export interface Entry {
  word: string;
  senses: (Omit<Sense, "id" | "word_id" | "word_examples"> & {
    examples: Example[];
  })[];
  pronunciations: Pronunciation[];
}
export interface Question {
  sense: Sense;
  word: UserWord;
  type: ReviewType;
  prompt: string;
  choices?: string[];
  sentence?: string;
}
export interface ReviewSubmission {
  request_id: string;
  sense_id: string;
  type: ReviewType;
  answer: string;
  response_time_ms: number;
}
export interface ReviewResult {
  correct: boolean;
  feedback: string;
  duplicate?: boolean;
  queued?: boolean;
}
export interface SearchResult {
  match_quality?: "strong" | "approximate";
  sense_id: string;
  word_id: string;
  word: string;
  part_of_speech: string;
  definition: string;
  simple_definition: string;
  in_vocabulary: boolean;
  discovered_at: string | null;
  score: number;
}
export interface TutorReply {
  session_id: string;
  message: string;
  suggestions: string[];
  exercise: {
    sense_id: string;
    word: string;
    question: string;
    type: ReviewType;
  } | null;
}
export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  structured_content: TutorReply | null;
}
