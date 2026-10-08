import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  Trash2,
  RotateCcw,
  Check,
  Loader2,
  BookOpen,
  Sparkles,
} from "lucide-react";
import { useData } from "../app/providers/DataProvider";
import { useAuth } from "../app/providers/AuthProvider";
import { ErrorNotice, useToast } from "../app/providers/UIProvider";
import {
  Empty,
  Spinner,
  Meter,
  Pronounce,
  PronunciationText,
  Modal,
} from "../components/ui";
import { updateWord, deleteWord } from "../services/vocabulary";
import { errorMessage } from "../lib/api";
import { average, dateLabel, relativeDate } from "../lib/utils";
export function WordDetails() {
  const { id } = useParams();
  const { data, loading, refresh, online } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const word = data.words.find((w) => w.word_id === id);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(
    () => setNote(word?.personal_note || ""),
    [word?.id, word?.personal_note],
  );
  if (loading) return <Spinner />;
  if (!word)
    return (
      <Empty
        title="This word isn’t in your collection."
        description="It may have been removed, or you may be signed in to another account."
        action={
          <Link className="button primary" to="/vocabulary">
            Back to my words
          </Link>
        }
      />
    );
  const scores = data.progress.filter((p) =>
    word.words.word_senses.some((s) => s.id === p.sense_id),
  );
  const next = scores.map((p) => p.next_review_at).sort()[0];
  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await refresh();
      toast(message);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" to="/vocabulary">
        <ArrowLeft size={17} />
        Back to my vocabulary
      </Link>
      <div className="word-detail-heading">
        <div>
          <p className="eyebrow">A WORD WORTH UNDERSTANDING</p>
          <div className="word-title-row">
            <h1>{word.words.word}</h1>
            <Pronounce
              word={word.words.word}
              audio={word.words.pronunciations[0]?.audio_url}
            />
          </div>
          <div className="pronunciation-line">
            <PronunciationText pronunciations={word.words.pronunciations} />
            <span className={`status-tag ${word.status}`}>{word.status}</span>
          </div>
        </div>
        <Link className="button primary" to={`/review?word=${word.word_id}`}>
          Practise this word <ArrowRight size={17} />
        </Link>
      </div>
      <ErrorNotice message={error} />
      {word.status === "new" && (
        <div className="understood-banner">
          <p>
            Found your meaning? Mark this word as learning and try a little
            practice.
          </p>
          <button
            className="button secondary small"
            disabled={busy || !online}
            onClick={() =>
              void run(
                () => updateWord(user!.id, word.id, { status: "learning" }),
                "Ready to practise. Your first review is already scheduled.",
              )
            }
          >
            <Check size={16} />I understand it
          </button>
        </div>
      )}
      <div className="detail-grid">
        <div>
          <section className="panel meanings-panel">
            <div className="section-heading">
              <h2>A little beyond the definition.</h2>
              <span className="subtle">
                {word.words.word_senses.length} meanings
              </span>
            </div>
            {word.words.word_senses.map((sense, i) => (
              <article className="sense" key={sense.id}>
                <div className="sense-label">
                  <span className="eyebrow">
                    MEANING {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="sense-tags">
                    {sense.part_of_speech} · {sense.difficulty}
                  </span>
                </div>
                <h3>{sense.definition}</h3>
                {sense.simple_definition !== sense.definition && (
                  <p>{sense.simple_definition}</p>
                )}
                {sense.word_examples.map((example, j) => (
                  <blockquote key={j}>
                    “{example.sentence}”<small>{example.source}</small>
                  </blockquote>
                ))}
                {sense.usage_note && (
                  <div className="usage-note">
                    <Sparkles size={17} />
                    <p>{sense.usage_note}</p>
                  </div>
                )}
                {sense.phrases.length > 0 && (
                  <div className="phrase-list">
                    <span className="eyebrow">USEFUL PAIRINGS</span>
                    {sense.phrases.map((p) => (
                      <span className="soft-tag" key={p}>
                        {p}
                      </span>
                    ))}
                  </div>
                )}
                {sense.synonyms.length > 0 && (
                  <div className="synonyms">
                    <span>Similar words</span>
                    {sense.synonyms.map((s) => (
                      <span className="soft-tag" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <div className="source-credit">
                  Meaning from{" "}
                  {sense.source_url ? (
                    <a href={sense.source_url} target="_blank" rel="noreferrer">
                      {sense.lexical_source}
                    </a>
                  ) : (
                    sense.lexical_source
                  )}
                  {sense.ai_enriched ? " · Learning notes enriched by AI" : ""}
                  {sense.source_license && (
                    <small>{sense.source_license}</small>
                  )}
                </div>
              </article>
            ))}
          </section>
          <section className="panel note-panel">
            <p className="eyebrow">A NOTE TO YOUR FUTURE SELF</p>
            <h2>Give this word a personal connection.</h2>
            <textarea
              aria-label="Personal note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="A memory trick, a situation where you might use it…"
            />
            <button
              className="button secondary"
              disabled={busy || !online || note === word.personal_note}
              onClick={() =>
                void run(
                  () => updateWord(user!.id, word.id, { personal_note: note }),
                  "Your note is saved.",
                )
              }
            >
              <Check size={17} />
              Save my note
            </button>
          </section>
        </div>
        <aside className="detail-aside">
          <section className="panel">
            <p className="eyebrow">YOUR LEARNING</p>
            <h2>A little stronger, every time.</h2>
            <Meter
              label="Understanding"
              value={average(scores.map((p) => p.understanding_score))}
            />
            <Meter
              label="Recall"
              value={average(scores.map((p) => p.recall_score))}
            />
            <Meter
              label="Using in sentences"
              value={average(scores.map((p) => p.usage_score))}
            />
            <Meter
              label="Spoken word recognition"
              value={average(scores.map((p) => p.pronunciation_score))}
            />
            <p className="tiny-note">
              Spoken recognition checks a browser transcript; it does not score
              your accent.
            </p>
            <Link
              className="text-link"
              to={`/review?word=${word.word_id}&type=pronunciation`}
            >
              Practise saying it <ArrowRight size={15} />
            </Link>
            <div className="next-review">
              <TargetIcon />
              <span>
                Next review
                <strong>{next ? relativeDate(next) : "Not scheduled"}</strong>
              </span>
            </div>
          </section>
          <section className="panel encounter-panel">
            <p className="eyebrow">WHERE YOUR STORY BEGAN</p>
            <h3>{word.source || "A little discovery"}</h3>
            {word.encounter_context && (
              <blockquote>“{word.encounter_context}”</blockquote>
            )}
            <p>Discovered {dateLabel(word.discovered_at)}</p>
          </section>
          <div className="word-actions">
            <button
              className="button secondary"
              disabled={busy || !online}
              onClick={() =>
                void run(
                  () =>
                    updateWord(user!.id, word.id, {
                      status:
                        word.status === "archived" ? "learning" : "archived",
                    }),
                  word.status === "archived"
                    ? "Welcome back to your collection."
                    : "Word archived. You can restore it anytime.",
                )
              }
            >
              {word.status === "archived" ? (
                <RotateCcw size={17} />
              ) : (
                <Archive size={17} />
              )}{" "}
              {word.status === "archived" ? "Restore word" : "Archive word"}
            </button>
            <button
              className="button text-danger"
              disabled={busy || !online}
              onClick={() => setConfirm(true)}
            >
              <Trash2 size={17} />
              Delete word
            </button>
          </div>
        </aside>
      </div>
      <Modal
        open={confirm}
        onClose={() => {
          if (!busy) setConfirm(false);
        }}
        title={`Delete “${word.words.word}”?`}
      >
        <p>
          This removes this word, its learning progress, and its review history
          from your account.
        </p>
        <div className="modal-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setConfirm(false)}
          >
            Keep my word
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await deleteWord(word.word_id);
                navigate("/vocabulary");
              }, "Word removed from your vocabulary.")
            }
          >
            {busy ? (
              <Loader2 className="spin" size={18} />
            ) : (
              <Trash2 size={18} />
            )}
            Delete word
          </button>
        </div>
      </Modal>
    </>
  );
}
function TargetIcon() {
  return <BookOpen size={20} />;
}
