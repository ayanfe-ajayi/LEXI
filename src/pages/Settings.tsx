import { useState, useEffect } from "react";
import {
  Bell,
  User,
  Globe,
  Download,
  Check,
  Loader2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useData } from "../app/providers/DataProvider";
import { useAuth } from "../app/providers/AuthProvider";
import { useToast, ErrorNotice } from "../app/providers/UIProvider";
import { PageHeading, Spinner } from "../components/ui";
import { saveSettings, enablePush, disablePush } from "../services/settings";
import { errorMessage } from "../lib/api";
import { invoke } from "../lib/api";
import { initials } from "../lib/utils";
import type { Preferences } from "../types";
export function SettingsPage() {
  const { user } = useAuth();
  const { data, loading, online, refresh, pending } = useData();
  const toast = useToast();
  const [name, setName] = useState("");
  const [preferences, setPreferences] = useState<Preferences>({
    user_id: user!.id,
    enabled: false,
    preferred_time: "09:00",
    timezone: "Africa/Lagos",
    daily_limit: 10,
    frequency: "daily",
    quiet_start: "22:00",
    quiet_end: "07:00",
  });
  const [busy, setBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [error, setError] = useState("");
  const [push, setPush] = useState(false);
  const [update, setUpdate] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [indexProgress, setIndexProgress] = useState("");
  useEffect(() => {
    setName(data.profile?.display_name || "");
    if (data.preferences) setPreferences(data.preferences);
  }, [data.profile?.display_name, data.preferences]);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .getRegistration()
        .then(async (r) => {
          setPush(Boolean(await r?.pushManager.getSubscription()));
          setUpdate(Boolean(r?.waiting));
        })
        .catch(() => {});
    const handler = () => setUpdate(true);
    window.addEventListener("lexi-update-ready", handler);
    return () => window.removeEventListener("lexi-update-ready", handler);
  }, []);
  if (loading) return <Spinner />;
  function patch<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPreferences((p) => ({ ...p, [key]: value }));
  }
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (!name.trim()) throw new Error("Please enter your display name.");
      try {
        new Intl.DateTimeFormat(undefined, { timeZone: preferences.timezone });
      } catch {
        throw new Error("Choose a valid timezone.");
      }
      await saveSettings(user!.id, name.trim(), preferences);
      await refresh();
      toast("Your preferences are saved.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function togglePush() {
    setPushBusy(true);
    setError("");
    try {
      if (push) {
        await disablePush(user!.id);
        setPush(false);
        toast("Notifications disabled on this device.");
      } else {
        await enablePush(user!.id);
        setPush(true);
        toast("This device is ready for review notifications.");
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPushBusy(false);
    }
  }
  function exportWords() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            vocabulary: data.words,
            progress: data.progress,
            reviews: data.reviews,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lexi-vocabulary-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  async function indexCollection() {
    setIndexing(true);
    setError("");
    try {
      const active = data.words.filter((word) => word.status !== "archived");
      for (let i = 0; i < active.length; i++) {
        setIndexProgress(`${i + 1} of ${active.length} words`);
        const result = await invoke<{ indexed: boolean }>("vocabulary", {
          action: "index",
          word_id: active[i].word_id,
        });
        if (!result.indexed)
          throw new Error(
            "Configure AI_API_KEY in the backend before indexing your collection.",
          );
      }
      toast("Your collection is ready for meaning search.");
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setIndexing(false);
      setIndexProgress("");
    }
  }
  const timezones = Array.from(
    new Set([
      "Africa/Lagos",
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...Intl.supportedValuesOf("timeZone"),
    ]),
  );
  return (
    <>
      <PageHeading
        eyebrow="MAKE THIS SPACE YOURS"
        title="A rhythm that works for you."
        description="A few thoughtful preferences for your learning journey."
      />
      <ErrorNotice message={error} />
      <div className="settings-grid">
        <div>
          <section className="panel settings-section">
            <div className="settings-title">
              <span className="stat-icon">
                <User size={21} />
              </span>
              <div>
                <h2>A little about you.</h2>
                <p>Your personal learning space.</p>
              </div>
            </div>
            <div className="profile-preview">
              <span className="avatar large">{initials(name)}</span>
              <div>
                <strong>{name || "Word explorer"}</strong>
                <p>{user?.email}</p>
              </div>
            </div>
            <label>
              Display name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="What should we call you?"
                required
              />
            </label>
            <label>
              <Globe size={15} />
              Your timezone
              <select
                value={preferences.timezone}
                onChange={(e) => patch("timezone", e.target.value)}
              >
                {timezones.map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </select>
            </label>
          </section>
          <section className="panel settings-section">
            <div className="settings-title">
              <span className="stat-icon">
                <Bell size={21} />
              </span>
              <div>
                <h2>A gentle nudge.</h2>
                <p>Make a little space for your words.</p>
              </div>
            </div>
            <div className="setting-toggle">
              <div>
                <strong>Practice reminders</strong>
                <p>Only when your words need a little attention.</p>
              </div>
              <button
                className={`switch ${preferences.enabled ? "on" : ""}`}
                role="switch"
                aria-checked={preferences.enabled}
                aria-label="Practice reminders"
                onClick={() => patch("enabled", !preferences.enabled)}
              >
                <span />
              </button>
            </div>
            <div className="settings-form-grid">
              <label>
                Preferred time
                <input
                  type="time"
                  value={preferences.preferred_time.slice(0, 5)}
                  onChange={(e) => patch("preferred_time", e.target.value)}
                  required
                />
              </label>
              <label>
                Daily review limit
                <select
                  value={preferences.daily_limit}
                  onChange={(e) => patch("daily_limit", Number(e.target.value))}
                >
                  {[5, 10, 15, 20, 30, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} word senses
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Frequency
                <select
                  value={preferences.frequency}
                  onChange={(e) =>
                    patch(
                      "frequency",
                      e.target.value as Preferences["frequency"],
                    )
                  }
                >
                  <option value="daily">Every day</option>
                  <option value="weekdays">Weekdays</option>
                </select>
              </label>
            </div>
            <p className="eyebrow">A LITTLE QUIET TIME</p>
            <div className="settings-form-grid">
              <label>
                Quiet hours begin
                <input
                  type="time"
                  value={preferences.quiet_start.slice(0, 5)}
                  onChange={(e) => patch("quiet_start", e.target.value)}
                  required
                />
              </label>
              <label>
                Quiet hours end
                <input
                  type="time"
                  value={preferences.quiet_end.slice(0, 5)}
                  onChange={(e) => patch("quiet_end", e.target.value)}
                  required
                />
              </label>
            </div>
            <div className="push-setting">
              <div>
                <strong>Notifications on this device</strong>
                <p>Browser permission and server delivery are required.</p>
              </div>
              <button
                className="button secondary small"
                disabled={pushBusy || !online}
                onClick={() => void togglePush()}
              >
                {pushBusy ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <Bell size={16} />
                )}{" "}
                {push ? "Disable" : "Enable"}
              </button>
            </div>
          </section>
          <button
            className="button primary"
            disabled={busy || !online}
            onClick={() => void save()}
          >
            {busy ? (
              <Loader2 size={18} className="spin" />
            ) : (
              <Check size={18} />
            )}
            Save my preferences
          </button>
        </div>
        <aside>
          <section className="panel settings-section">
            <span className="stat-icon">
              <Download size={21} />
            </span>
            <h2>
              Your words,
              <br />
              wherever you go.
            </h2>
            <p>
              Your downloaded collection is available offline on this device. AI
              tutoring and new word lookups need a connection.
            </p>
            <div className="offline-status">
              <span className={`dot ${online ? "green" : "coral"}`} />
              {online ? "You’re connected" : "Offline mode"}
              <span>{pending} pending reviews</span>
            </div>
            <button
              className="button secondary wide"
              disabled={!online}
              onClick={() => void refresh()}
            >
              <RefreshCw size={17} />
              Refresh my collection
            </button>
            <button className="button secondary wide" onClick={exportWords}>
              <Download size={17} />
              Export my words
            </button>
            <button
              className="button secondary wide"
              disabled={!online || indexing || !data.words.length}
              onClick={() => void indexCollection()}
            >
              {indexing ? (
                <Loader2 className="spin" size={17} />
              ) : (
                <RefreshCw size={17} />
              )}
              Prepare meaning search
            </button>
            {indexProgress && (
              <p role="status" className="tiny-note">
                Indexing {indexProgress}
              </p>
            )}
            {update && (
              <button
                className="button primary wide"
                onClick={async () => {
                  const r = await navigator.serviceWorker.getRegistration();
                  r?.waiting?.postMessage({ type: "SKIP_WAITING" });
                  navigator.serviceWorker.addEventListener(
                    "controllerchange",
                    () => location.reload(),
                    { once: true },
                  );
                }}
              >
                Update Lexi
              </button>
            )}
          </section>
          <section className="privacy-note">
            <ShieldCheck size={24} />
            <h3>A space that belongs to you.</h3>
            <p>
              Your vocabulary and learning history are private to your account.
              Only relevant information is sent to the tutor for each question.
            </p>
          </section>
          <p className="version-note">
            Lexi · Version 1.0
            <br />
            One word at a time.
          </p>
        </aside>
      </div>
    </>
  );
}
