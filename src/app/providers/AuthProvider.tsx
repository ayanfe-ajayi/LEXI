import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  supabase,
  offlineSessionUser,
  rememberOfflineUser,
  removeLocalSession,
} from "../../lib/supabase";
import { clearUserCache } from "../../services/offline";
import { disablePush } from "../../services/settings";
interface AuthState {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signOut: async () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(offlineSessionUser);
  const [loading, setLoading] = useState(
    () => navigator.onLine && !offlineSessionUser(),
  );
  useEffect(() => {
    let active = true;
    if (navigator.onLine)
      supabase.auth
        .getSession()
        .then(({ data }) => {
          if (active) {
            if (data.session?.user) rememberOfflineUser(data.session.user);
            setUser(data.session?.user || null);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) setLoading(false);
        });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!navigator.onLine && !session && offlineSessionUser()) return;
      if (session?.user) rememberOfflineUser(session.user);
      else if (event === "SIGNED_OUT") rememberOfflineUser(null);
      setUser(session?.user || null);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  async function signOut() {
    if (user) {
      try {
        await disablePush(user.id);
      } catch {
        /* Logout must remain available even when push delivery is unreachable. */
      }
      await clearUserCache(user.id);
    }
    if (!navigator.onLine) {
      supabase.auth.stopAutoRefresh();
      removeLocalSession();
      setUser(null);
      return;
    }
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    rememberOfflineUser(null);
    setUser(null);
  }
  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
