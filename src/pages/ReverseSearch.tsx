import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Loader2,
  Check,
} from "lucide-react";
import { useData } from "../app/providers/DataProvider";
import { PageHeading, Empty } from "../components/ui";
import { ErrorNotice } from "../app/providers/UIProvider";
import { searchMeaning } from "../services/tutor";
import { errorMessage } from "../lib/api";
import { dateLabel } from "../lib/utils";
import type { SearchResult } from "../types";
const ideas = [
  "Doing something without intending to",
  "Very careful about the smallest details",
  "Something difficult or awkward to handle",
];
export function ReverseSearch() {
  const { online } = useData();
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(true);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [explanation, setExplanation] = useState("");
  const [mode, setMode] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function search(e?: FormEvent, value = query) {
    e?.preventDefault();
    if (value.trim().length < 2) return;
    setQuery(value);
    setBusy(true);
    setError("");
    setResults(null);
    setExplanation("");
    setNotice("");
    try {
      const result = await searchMeaning(value, mine);
      setResults(result.results);
      setExplanation(result.explanation);
      setMode(result.mode);
      setNotice(result.notice || "");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="WHEN THE MEANING COMES FIRST"
        title="It’s on the tip of your tongue."
        description="Describe what you mean. Let’s find the word together."
      />
      <section className="meaning-search-panel">
        <span className="search-spark">
          <Sparkles size={27} />
        </span>
        <h2>
          You remember the idea.
          <br />
          We’ll help with the word.
        </h2>
        <form onSubmit={(e) => void search(e)}>
          <div className="meaning-input">
            <Search size={21} />
            <input
              aria-label="Describe a word’s meaning"
              placeholder="A word for doing something secretly…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={500}
              minLength={2}
              required
            />
            <button className="button primary" disabled={busy || !online}>
              {busy ? (
                <Loader2 size={18} className="spin" />
              ) : (
                <>
                  Find my word <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={mine}
              disabled={busy}
              onChange={(e) => {
                setMine(e.target.checked);
                setResults(null);
                setExplanation("");
                setNotice("");
              }}
            />
            Search only my saved vocabulary
          </label>
        </form>
        <div className="search-ideas">
          <span>A little inspiration</span>
          {ideas.map((idea) => (
            <button
              key={idea}
              onClick={() => void search(undefined, idea)}
              disabled={busy || !online}
            >
              {idea}
              <ArrowUpRight size={14} />
            </button>
          ))}
        </div>
      </section>
      <ErrorNotice message={error} />
      {results !== null && (
        <section>
          <div className="section-heading">
            <h2>
              {results.length
                ? "A few words that might fit."
                : "Let’s try another description."}
            </h2>
            <span className="subtle">
              {mode === "discovery"
                ? "Broader word suggestions"
                : mode === "hybrid"
                  ? "Meaning + text search"
                  : "Text search · semantic search unavailable"}
            </span>
          </div>
          {notice && (
            <p className="tiny-note" role="status">
              {notice}
            </p>
          )}
          {explanation && (
            <div className="search-explanation">
              <Sparkles size={20} />
              <p>{explanation}</p>
            </div>
          )}
          {results.length ? (
            <div className="search-results">
              {results.map((r, i) => (
                <article className="search-result panel" key={r.sense_id}>
                  <span className="result-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <span className="word-pos">{r.part_of_speech}</span>
                    <h3>{r.word}</h3>
                    <p>{r.simple_definition}</p>
                    {r.match_quality === "approximate" && (
                      <span className="subtle">Approximate match</span>
                    )}
                    {r.in_vocabulary && (
                      <div className="saved-indicator">
                        <Check size={14} />
                        In your vocabulary
                        {r.discovered_at &&
                          ` · Discovered ${dateLabel(r.discovered_at)}`}
                      </div>
                    )}
                  </div>
                  {r.in_vocabulary && (
                    <Link
                      className="icon-button"
                      aria-label={`Open ${r.word}`}
                      to={`/words/${r.word_id}`}
                    >
                      <ArrowUpRight />
                    </Link>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="panel">
              <Empty
                title="No matching word senses yet."
                description={
                  mine
                    ? "Try a clearer description, or uncheck ‘Search only my saved vocabulary’ to discover other words."
                    : "Try a clearer description, an example sentence, or a different wording."
                }
              />
            </div>
          )}
          <p className="tiny-note">
            {mine
              ? "Searching your saved vocabulary."
              : "Broader suggestions are checked against dictionary definitions. They are not automatically added to your vocabulary."}
          </p>
        </section>
      )}
      <div className="subtle-note">
        <Sparkles size={16} />
        Sometimes a meaning is the best way back to a word.
      </div>
    </>
  );
}
