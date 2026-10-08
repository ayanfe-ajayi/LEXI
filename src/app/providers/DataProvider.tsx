import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthProvider";
import { loadSnapshot } from "../../services/vocabulary";
import {
  cachedSnapshot,
  cacheSnapshot,
  syncReviews,
  pendingReviews,
  clearUserCache,
} from "../../services/offline";
import { errorMessage } from "../../lib/api";
import type { Snapshot } from "../../types";
export const emptySnapshot: Snapshot = {
  words: [],
  progress: [],
  reviews: [],
  profile: null,
  preferences: null,
  cached_at: "",
};
interface DataState {
  data: Snapshot;
  loading: boolean;
  error: string;
  online: boolean;
  cached: boolean;
  pending: number;
  refresh: () => Promise<void>;
}
const DataContext = createContext<DataState>({
  data: emptySnapshot,
  loading: true,
  error: "",
  online: true,
  cached: false,
  pending: 0,
  refresh: async () => {},
});
export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [cached, setCached] = useState(false);
  const [pending, setPending] = useState(0);
  const currentUser = useRef(user?.id);
  currentUser.current = user?.id;
  const busy = useRef(false);
  async function refresh() {
    const id = user?.id;
    if (!id || busy.current) return;
    busy.current = true;
    try {
      if (navigator.onLine) {
        let syncError = "";
        try {
          await syncReviews(id);
        } catch (e) {
          syncError = `A queued review could not sync: ${errorMessage(e)}`;
        }
        const value = await loadSnapshot(id);
        if (currentUser.current !== id) return;
        setData(value);
        setCached(false);
        setError(syncError);
        await cacheSnapshot(id, value);
        if (currentUser.current !== id) await clearUserCache(id);
      } else {
        const value = await cachedSnapshot(id);
        if (currentUser.current !== id) return;
        if (value) {
          setData(value);
          setCached(true);
          setError("");
        } else
          setError(
            "No saved vocabulary is available on this device yet. Connect to download your words.",
          );
      }
      if (currentUser.current === id) setPending(await pendingReviews(id));
    } catch (e) {
      if (currentUser.current === id) {
        setError(errorMessage(e));
        const value = await cachedSnapshot(id);
        if (currentUser.current !== id) return;
        if (value) {
          setData(value);
          setCached(true);
        }
      }
    } finally {
      busy.current = false;
      if (currentUser.current === id) setLoading(false);
    }
  }
  useEffect(() => {
    currentUser.current = user?.id;
    setData(emptySnapshot);
    setLoading(true);
    setError("");
    setCached(false);
    busy.current = false;
    void refresh();
    return () => {
      currentUser.current = undefined;
    };
  }, [user?.id]); // The authenticated identity owns this entire cache.
  useEffect(() => {
    const on = () => {
      setOnline(true);
      void refresh();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [user?.id]);
  return (
    <DataContext.Provider
      value={{ data, loading, error, online, cached, pending, refresh }}
    >
      {children}
    </DataContext.Provider>
  );
}
export const useData = () => useContext(DataContext);
