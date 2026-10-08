import { type ReactNode, useEffect, useRef, useState } from "react";
import { ArrowRight, BookOpen, Loader2, Volume2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { readablePronunciation } from "../lib/pronunciation";
import type { Pronunciation } from "../types";
export function Spinner({ label = "Loading your words…" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <Loader2 className="spin" size={24} />
      <span>{label}</span>
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <BookOpen size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="subtitle">{description}</p>
      </div>
      {action}
    </header>
  );
}
export function SectionHeading({
  title,
  to,
  label = "View all",
}: {
  title: string;
  to?: string;
  label?: string;
}) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {to && (
        <Link className="text-link" to={to}>
          {label}
          <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
export function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="meter">
      <div>
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div
        className="meter-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      className="modal"
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Pronounce({
  word,
  audio,
}: {
  word: string;
  audio?: string | null;
}) {
  const [error, setError] = useState("");
  const [rate, setRate] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("lexi:pronunciation-rate"));
      return [0.7, 1, 1.3].includes(saved) ? saved : 1;
    } catch {
      return 1;
    }
  });
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  useEffect(
    () => () => {
      playerRef.current?.pause();
      if (utteranceRef.current && "speechSynthesis" in window)
        window.speechSynthesis.cancel();
    },
    [],
  );
  function changeRate(value: number) {
    setRate(value);
    if (playerRef.current) playerRef.current.playbackRate = value;
    try {
      localStorage.setItem("lexi:pronunciation-rate", String(value));
    } catch {
      /* Playback still works without storage. */
    }
  }
  function speak() {
    setError("");
    playerRef.current?.pause();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (audio) {
      const player = new Audio(audio);
      playerRef.current = player;
      player.playbackRate = rate;
      player.preservesPitch = true;
      player.play().catch(() => fallback());
    } else fallback();
  }
  function fallback() {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = "en-GB";
      utterance.rate = rate;
      utteranceRef.current = utterance;
      utterance.onend = () => {
        utteranceRef.current = null;
      };
      utterance.onerror = (event) => {
        utteranceRef.current = null;
        if (event.error !== "canceled" && event.error !== "interrupted")
          setError("Audio is unavailable. Please try again.");
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } else setError("Audio is unavailable in this browser.");
  }
  return (
    <span className="pronunciation-controls">
      <button
        type="button"
        className="icon-button pronunciation"
        aria-label={`Hear ${word}`}
        onClick={speak}
      >
        <Volume2 size={22} />
      </button>
      <select
        aria-label={`Pronunciation speed for ${word}`}
        value={rate}
        onChange={(event) => changeRate(Number(event.target.value))}
      >
        <option value={0.7}>Slow</option>
        <option value={1}>Normal</option>
        <option value={1.3}>Fast</option>
      </select>
      {error && <small role="status">{error}</small>}
    </span>
  );
}

export function PronunciationText({
  pronunciations,
}: {
  pronunciations: Pronunciation[];
}) {
  const pronunciation = pronunciations.find((p) => p.ipa.trim());
  if (!pronunciation)
    return (
      <span className="phonetic-guide">
        Phonetic transcription unavailable · Tap Hear to listen
      </span>
    );
  const readable = readablePronunciation(pronunciation.ipa);
  return (
    <span className="phonetic-guide">
      <span className="phonetic-ipa">{pronunciation.ipa}</span>
      {readable && (
        <span className="phonetic-readable">
          <strong>{readable}</strong>
          <small>Approximate · Capitals mark stress</small>
        </span>
      )}
    </span>
  );
}
