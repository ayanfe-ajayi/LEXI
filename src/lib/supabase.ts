import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
export const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export function offlineSessionUser(): User | null {
  if (navigator.onLine || !configured) return null;
  try {
    const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(
      ".",
    )[0];
    const remembered = JSON.parse(
      localStorage.getItem(`lexi:offline-user:${ref}`) || "null",
    );
    const stored = JSON.parse(
      localStorage.getItem(`sb-${ref}-auth-token`) || "null",
    );
    const user = remembered || stored?.user;
    return typeof user?.id === "string" && /^[0-9a-f-]{36}$/i.test(user.id)
      ? (user as User)
      : null;
  } catch {
    return null;
  }
}
export function rememberOfflineUser(user: User | null) {
  if (!configured) return;
  const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0];
  if (user)
    localStorage.setItem(`lexi:offline-user:${ref}`, JSON.stringify(user));
  else localStorage.removeItem(`lexi:offline-user:${ref}`);
}
export function removeLocalSession() {
  if (!configured) return;
  const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0];
  localStorage.removeItem(`sb-${ref}-auth-token`);
  rememberOfflineUser(null);
}
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || "https://unconfigured.supabase.co",
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "unconfigured",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
