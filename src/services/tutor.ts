import { invoke, checked } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { TutorReply, Message, SearchResult } from "../types";
export function askTutor(message: string, session_id: string | null) {
  return invoke<TutorReply>("ai", { message, session_id });
}
export function searchMeaning(query: string, mine: boolean) {
  return invoke<{
    results: SearchResult[];
    explanation: string;
    mode: "hybrid" | "text";
  }>("reverse-search", { query, mine });
}
export async function tutorSessions(user: string) {
  return (
    checked(
      await supabase
        .from("ai_sessions")
        .select("id,title,updated_at")
        .eq("user_id", user)
        .order("updated_at", { ascending: false })
        .limit(30),
    ) || []
  );
}
export async function tutorMessages(session: string): Promise<Message[]> {
  return (
    checked(
      await supabase
        .from("ai_messages")
        .select("*")
        .eq("session_id", session)
        .order("created_at"),
    ) || []
  );
}
