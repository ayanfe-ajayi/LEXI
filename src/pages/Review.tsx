import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  RotateCcw,
  Sparkles,
  Target,
  Loader2,
  Mic,
  Volume2,
} from "lucide-react";
import { useData } from "../app/providers/DataProvider";
import { useAuth } from "../app/providers/AuthProvider";
import { ErrorNotice } from "../app/providers/UIProvider";
import {
  makeQuestions,
  practicePronunciation,
  normalizeAnswer,
  submitReview,
} from "../services/review";
import { enqueueReview, queuedReviews } from "../services/offline";
import { errorMessage } from "../lib/api";
import {
  Spinner,
  Empty,
  PageHeading,
  Pronounce,
  PronunciationText,
} from "../components/ui";
import type { Question, ReviewResult, ReviewType } from "../types";
const labels: Record<ReviewType, string> = {
  meaning: "In your own words",
  recognition: "Connect the meaning",
  active_recall: "In your own words",
  fill_blank: "Fill in the missing word",
  usage: "Make it yours",
  pronunciation: "Say it out loud",
  reverse_recall: "Find the word",
};
type SpeechInstance = {
  lang: string;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: {
          [index: number]: { [index: number]: { transcript: string } };
        };
      }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
export function Review({ quiz = false }: { quiz?: boolean }) {
  const { data, loading, online, refresh } = useData();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<ReviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [correct, setCorrect] = useState(0);
  const [listening, setListening] = useState(false);
  const speech = useRef<SpeechInstance | null>(null);
  const request = useRef(crypto.randomUUID());
  const start = useRef(Date.now());
  const config = `${quiz}:${params.toString()}`;
  const configured = useRef("");
  useEffect(() => {
    if (loading || configured.current === config) return;
    configured.current = config;
    const senseId = params.get("sense");
    const wordId =
      (senseId
        ? data.words.find((w) =>
            w.words.word_senses.some((s) => s.id === senseId),
          )?.word_id
        : params.get("word")) || undefined;
    let qs = makeQuestions(data, quiz ? "quiz" : "due", wordId);
    if (senseId) qs = qs.filter((q) => q.sense.id === senseId);
    const type = params.get("type");
    if (type === "usage")
      qs = qs.map((q) => ({
        ...q,
        type: "usage" as const,
        prompt: `Use “${q.word.words.word}” in a sentence.`,
      }));
    if (type === "pronunciation") {
      const w = data.words.find(
        (w) => w.word_id === wordId && w.status !== "archived",
      );
      qs = w ? [practicePronunciation(w)] : [];
    }
    // A queued offline attempt must sync before the same sense is reviewed again.
    void queuedReviews(user!.id)
      .then((queued) => {
        if (configured.current !== config) return;
        const pending = new Set(queued.map((review) => review.sense_id));
        setQuestions(qs.filter((question) => !pending.has(question.sense.id)));
      })
      .catch(() => setQuestions(qs));
    setIndex(0);
    setAnswer("");
    setFeedback(null);
    setCorrect(0);
    setError("");
    start.current = Date.now();
    request.current = crypto.randomUUID();
  }, [loading, config, data]);
  useEffect(() => () => speech.current?.stop(), []);
  if (loading || questions === null)
    return <Spinner label="Getting your practice ready…" />;
  const q = questions[index];
  async function submit() {
    if (!q || !answer.trim() || feedback || busy) return;
    setBusy(true);
    setError("");
    try {
      const payload = {
        request_id: request.current,
        sense_id: q.sense.id,
        type: q.type,
        answer: answer.trim(),
        response_time_ms: Math.min(3600000, Date.now() - start.current),
      };
      let result: ReviewResult;
      if (!online) {
        if (
          ![
            "recognition",
            "reverse_recall",
            "fill_blank",
            "pronunciation",
          ].includes(q.type)
        )
          throw new Error(
            "This answer needs the AI tutor to evaluate it. Reconnect to submit, or skip to a recall question.",
          );
        const expected =
          q.type === "recognition" ? q.sense.definition : q.word.words.word;
        const isCorrect = normalizeAnswer(answer) === normalizeAnswer(expected);
        await enqueueReview(user!.id, payload);
        result = {
          correct: isCorrect,
          feedback: isCorrect
            ? "Nicely done. This review will sync when you reconnect."
            : `The answer is “${expected}”. This review will sync when you reconnect.`,
          queued: true,
        };
      } else result = await submitReview(payload);
      setFeedback(result);
      if (result.correct) setCorrect((c) => c + 1);
      void refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  function next() {
    setIndex((i) => i + 1);
    setAnswer("");
    setFeedback(null);
    setError("");
    request.current = crypto.randomUUID();
    start.current = Date.now();
    if (index + 1 >= questions!.length) void refresh();
  }
  function recordSpeech() {
    const ctor =
      (
        window as unknown as {
          SpeechRecognition?: new () => SpeechInstance;
          webkitSpeechRecognition?: new () => SpeechInstance;
        }
      ).SpeechRecognition ||
      (
        window as unknown as {
          webkitSpeechRecognition?: new () => SpeechInstance;
        }
      ).webkitSpeechRecognition;
    if (!ctor) {
      setError(
        "Speech recognition isn’t supported in this browser. Try Chrome or Edge, or use another practice mode.",
      );
      return;
    }
    const instance = new ctor();
    instance.lang = "en-US";
    instance.interimResults = false;
    instance.onresult = (e) => {
      setAnswer(e.results[0][0].transcript);
      setListening(false);
    };
    instance.onerror = () => {
      setListening(false);
      setError(
        "We couldn’t hear you. Check microphone permission and try again.",
      );
    };
    instance.onend = () => setListening(false);
    speech.current = instance;
    setListening(true);
    instance.start();
  }
  return (
    <>
      <PageHeading
        eyebrow={
          quiz ? "A LITTLE EXTRA PRACTICE" : "A FEW MINUTES FOR FUTURE YOU"
        }
        title={quiz ? "Make those words stick." : "Let’s remember together."}
        description="Small moments of recall become lasting understanding."
      />
      {questions.length === 0 ? (
        <div className="panel">
          <Empty
            title="You’re all caught up."
            description="No word senses are due right now. You can practise your collection anytime, or save a new discovery."
            action={
              <Link
                className="button primary"
                to={quiz ? "/vocabulary" : "/quiz"}
              >
                {quiz ? "Explore my vocabulary" : "Try a quick practice"}
                <ArrowRight size={17} />
              </Link>
            }
          />
        </div>
      ) : !q ? (
        <div className="review-complete panel">
          <div className="completion-art">
            <Sparkles size={42} />
          </div>
          <p className="eyebrow">A LITTLE PROGRESS, WELL EARNED</p>
          <h2>
            Look at you,
            <br />
            making words stick.
          </h2>
          <p>
            You recalled {correct} of {questions.length} word senses correctly.
          </p>
          <div className="completion-stats">
            <div>
              <strong>{questions.length}</strong>
              <span>Practised</span>
            </div>
            <div>
              <strong>{Math.round((correct / questions.length) * 100)}%</strong>
              <span>Accuracy</span>
            </div>
          </div>
          <Link className="button primary" to="/dashboard">
            Back to my day <ArrowRight size={18} />
          </Link>
          <p className="tiny-note">
            Your next reviews adapt to today’s answers.
            {!online ? " Offline reviews sync when you reconnect." : ""}
          </p>
        </div>
      ) : (
        <div className="review-layout">
          <section className="review-main">
            <div className="review-session-header">
              <span>YOUR {quiz ? "PRACTICE" : "REVIEW"} SESSION</span>
              <span>
                {index + 1}
                <span className="subtle"> / {questions.length}</span>
              </span>
            </div>
            <div
              className="session-progress"
              role="progressbar"
              aria-label="Session progress"
              aria-valuenow={index}
              aria-valuemax={questions.length}
              aria-valuemin={0}
            >
              <span style={{ width: `${(index / questions.length) * 100}%` }} />
            </div>
            <div className="question-card panel">
              <span className="question-icon">
                {q.type === "reverse_recall" ? (
                  <RotateCcw size={24} />
                ) : q.type === "usage" ? (
                  <Sparkles size={24} />
                ) : q.type === "pronunciation" ? (
                  <Volume2 size={24} />
                ) : (
                  <Target size={24} />
                )}
              </span>
              <p className="eyebrow">{labels[q.type]}</p>
              <h2>{q.prompt}</h2>
              {q.type === "reverse_recall" && (
                <p className="question-hint">
                  You know the meaning. What’s the word?
                </p>
              )}
              {q.type === "fill_blank" && (
                <p className="question-hint">
                  Hint: {q.sense.simple_definition}
                </p>
              )}
              {q.type === "pronunciation" && (
                <div className="speech-actions">
                  <PronunciationText
                    pronunciations={q.word.words.pronunciations}
                  />
                  <Pronounce
                    word={q.word.words.word}
                    audio={q.word.words.pronunciations[0]?.audio_url}
                  />
                  <button
                    className="button secondary"
                    onClick={recordSpeech}
                    disabled={listening || Boolean(feedback)}
                  >
                    <Mic size={18} />
                    {listening ? "Listening…" : "Start microphone"}
                  </button>
                  <p className="tiny-note">
                    Checks the spoken transcript, not your accent. Your browser
                    may use a network speech service.
                  </p>
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                {q.choices ? (
                  <div className="answer-choices">
                    {q.choices.map((choice, i) => (
                      <button
                        type="button"
                        key={choice}
                        disabled={Boolean(feedback) || busy}
                        onClick={() => setAnswer(choice)}
                        className={`answer-choice ${answer === choice ? "selected" : ""}`}
                      >
                        <span>{String.fromCharCode(65 + i)}</span>
                        {choice}
                        {answer === choice && <Check size={18} />}
                      </button>
                    ))}
                  </div>
                ) : (
                  <label className="answer-label">
                    {q.type === "usage"
                      ? "Your sentence"
                      : q.type === "pronunciation"
                        ? "Recognised transcript"
                        : "Your answer"}
                    {q.type === "usage" || q.type === "active_recall" ? (
                      <textarea
                        autoFocus
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        disabled={Boolean(feedback) || busy}
                        placeholder={
                          q.type === "usage"
                            ? "Write a sentence that brings the word to life…"
                            : "Explain it in your own words…"
                        }
                        rows={3}
                        maxLength={2000}
                      />
                    ) : (
                      <input
                        autoFocus
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        disabled={
                          Boolean(feedback) ||
                          busy ||
                          q.type === "pronunciation"
                        }
                        autoComplete="off"
                        placeholder={
                          q.type === "pronunciation"
                            ? "Use the microphone to record your word"
                            : "Type the word that comes to mind…"
                        }
                        maxLength={2000}
                      />
                    )}
                  </label>
                )}
                <ErrorNotice message={error} />
                {!feedback ? (
                  <div className="review-controls">
                    <button
                      type="button"
                      className="text-link muted"
                      disabled={busy}
                      onClick={next}
                    >
                      Skip for now
                    </button>
                    <button
                      className="button primary"
                      disabled={!answer.trim() || busy}
                    >
                      {busy ? (
                        <Loader2 className="spin" size={18} />
                      ) : (
                        <>
                          Check my answer <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div
                    className={`review-feedback ${feedback.correct ? "correct" : "incorrect"}`}
                    role="status"
                  >
                    <div>
                      <span className="feedback-icon">
                        {feedback.correct ? (
                          <Check size={20} />
                        ) : (
                          <RotateCcw size={20} />
                        )}
                      </span>
                      <h3>
                        {feedback.correct
                          ? "That’s it. Nicely done!"
                          : "A little reminder helps."}
                      </h3>
                    </div>
                    <p>{feedback.feedback}</p>
                    {q.sense.word_examples[0] && (
                      <blockquote>
                        “{q.sense.word_examples[0].sentence}”
                      </blockquote>
                    )}
                    <button
                      className="button primary"
                      type="button"
                      onClick={next}
                    >
                      {index === questions.length - 1
                        ? "Finish my session"
                        : "Next word"}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                )}
              </form>
            </div>
            <Link className="back-link" to="/dashboard">
              <ArrowLeft size={15} />
              Come back to this later
            </Link>
          </section>
          <aside className="review-tip">
            <div className="tiny-star">✦</div>
            <p className="eyebrow">A LITTLE LEARNING TIP</p>
            <h3>
              Finding the word
              <br />
              is how you keep it.
            </h3>
            <p>
              Try to recall before looking it up. That little effort is what
              helps a word become yours.
            </p>
            <div className="tip-divider" />
            <p>
              It’s okay to forget.
              <br />
              That’s why we’re here.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
