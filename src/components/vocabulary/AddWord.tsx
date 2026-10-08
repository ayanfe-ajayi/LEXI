import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Loader2, Search, Sparkles } from "lucide-react";
import { Modal, Pronounce } from "../ui";
import { ErrorNotice, useToast } from "../../app/providers/UIProvider";
import { useData } from "../../app/providers/DataProvider";
import { analyzeWord, saveWord } from "../../services/vocabulary";
import { errorMessage } from "../../lib/api";
import type { Entry } from "../../types";
export function AddWord({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [word, setWord] = useState("");
  const [source, setSource] = useState("");
  const [context, setContext] = useState("");
  const [note, setNote] = useState("");
  const [entry, setEntry] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { refresh, online } = useData();
  const navigate = useNavigate();
  const toast = useToast();
  async function analyze(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setEntry(await analyzeWord(word.trim()));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function close() {
    if (busy) return;
    onClose();
    setWord("");
    setSource("");
    setContext("");
    setNote("");
    setEntry(null);
    setError("");
  }
  async function save() {
    if (!entry) return;
    setBusy(true);
    setError("");
    try {
      const result = await saveWord(entry.word, note, source, context);
      await refresh();
      toast(`“${entry.word}” is in your vocabulary.`);
      onClose();
      setEntry(null);
      setWord("");
      setSource("");
      setContext("");
      setNote("");
      navigate(`/words/${result.word_id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open={open} onClose={close} title="A new word, a new possibility.">
      <p className="subtitle">Save a discovery before it slips away.</p>
      <ErrorNotice message={error} />
      {!online && (
        <div className="error-notice">
          Connect to look up and save a new word.
        </div>
      )}
      <form onSubmit={analyze}>
        <label>
          The word
          <div className="input-with-icon">
            <Search size={18} />
            <input
              autoFocus
              placeholder="e.g. serendipitous"
              value={word}
              onChange={(e) => {
                setWord(e.target.value);
                setEntry(null);
              }}
              maxLength={80}
              pattern="[a-zA-Z][a-zA-Z '\-]*"
              required
            />
          </div>
        </label>
        <label>
          Where did you discover it?
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">Choose a source (optional)</option>
            {[
              "Movie or TV",
              "Book",
              "Conversation",
              "Article",
              "Podcast",
              "Somewhere else",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          The moment you found it <span className="optional">optional</span>
          <textarea
            placeholder="A line from the movie, a sentence, a little context…"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            maxLength={2000}
            rows={2}
          />
        </label>
        {!entry && (
          <button className="button primary wide" disabled={busy || !online}>
            {busy ? (
              <>
                <Loader2 size={18} className="spin" />
                Looking it up…
              </>
            ) : (
              <>
                Explore this word <Sparkles size={18} />
              </>
            )}
          </button>
        )}
      </form>
      {entry && (
        <div className="entry-preview">
          <div className="preview-title">
            <h3>{entry.word}</h3>
            <Pronounce
              word={entry.word}
              audio={entry.pronunciations[0]?.audio_url}
            />
          </div>
          {entry.senses.slice(0, 3).map((sense, i) => (
            <div className="preview-sense" key={i}>
              <span className="eyebrow">
                {sense.part_of_speech} · MEANING{" "}
                {String(i + 1).padStart(2, "0")}
              </span>
              <p>{sense.simple_definition}</p>
              {sense.examples[0] && (
                <blockquote>“{sense.examples[0].sentence}”</blockquote>
              )}
            </div>
          ))}
          {entry.senses.length > 3 && (
            <small>
              + {entry.senses.length - 3} more meanings saved with this word
            </small>
          )}
          <label>
            A note to your future self
            <textarea
              placeholder="A memory trick, a connection, anything that helps…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={2}
            />
          </label>
          <button
            className="button primary wide"
            onClick={save}
            disabled={busy || !online}
          >
            {busy ? (
              <Loader2 size={18} className="spin" />
            ) : (
              <>
                <Check size={18} />
                Keep this word <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="tiny-note">Your first review will be in one day.</p>
        </div>
      )}
    </Modal>
  );
}
