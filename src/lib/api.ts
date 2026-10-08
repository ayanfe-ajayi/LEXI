import { supabase } from "./supabase";
export function errorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String(error.message)
        : "Something went wrong. Please try again.";
  if (/schema cache|does not exist|Could not find the table/i.test(message))
    return "The Lexi database is not set up yet. Apply the migrations in supabase/migrations to your Supabase project.";
  if (/Failed to fetch|NetworkError|fetch failed/i.test(message))
    return "We could not connect. Check your internet connection and try again.";
  return message;
}
export async function invoke<T>(
  name: string,
  body: unknown,
  expectedUser?: string,
): Promise<T> {
  if (!navigator.onLine)
    throw new Error(
      "This feature needs an internet connection. Your saved vocabulary is still available offline.",
    );
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (expectedUser) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== expectedUser)
      throw new Error(
        "Sign in to the account that created these offline reviews to sync them.",
      );
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const { data, error } = await supabase.functions.invoke(name, {
    body: JSON.stringify(body),
    headers,
  });
  if (error) {
    if (error.context instanceof Response) {
      try {
        const detail = await error.context.json();
        if (detail.error) throw new Error(detail.error);
      } catch (e) {
        if (e instanceof Error && e.message && !/JSON/.test(e.message)) throw e;
      }
    }
    throw new Error(
      /Failed to send|fetch/i.test(error.message)
        ? "Could not reach the Lexi backend. Check your connection and confirm the Edge Functions are deployed."
        : error.message,
    );
  }
  return data as T;
}
export function checked<T>({
  data,
  error,
}: {
  data: T;
  error: { message: string } | null;
}): T {
  if (error) throw new Error(errorMessage(error));
  return data;
}
