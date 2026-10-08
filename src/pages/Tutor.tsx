import { useState, useEffect, useRef, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Send,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "../app/providers/AuthProvider";
import { useData } from "../app/providers/DataProvider";
import { ErrorNotice } from "../app/providers/UIProvider";
import { PageHeading } from "../components/ui";
import { askTutor, tutorSessions, tutorMessages } from "../services/tutor";
import { errorMessage } from "../lib/api";
import type { Message, TutorReply } from "../types";
const prompts = [
  {
    title: "Find the right word",
    text: "What word have I saved that means doing something without intending to?",
  },
  {
    title: "Build my confidence",
    text: "Help me practise a word I struggle to use in sentences.",
  },
  {
    title: "See what needs practice",
    text: "Which saved words am I struggling with?",
  },
  {
    title: "A fresh perspective",
    text: "Quiz me on a few words I learned recently.",
  },
];
export function Tutor() {
  const { user } = useAuth();
  const { online, refresh } = useData();
  const [sessions, setSessions] = useState<{ id: string; title: string }[]>([]);
  const [session, setSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const selected = useRef<string | null>(null);
  useEffect(() => {
    if (user && online)
      tutorSessions(user.id)
        .then(setSessions)
        .catch(() => {});
  }, [user?.id, online]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy]);
  async function send(e?: FormEvent, text = input) {
    e?.preventDefault();
    if (!text.trim() || busy || opening) return;
    setBusy(true);
    setError("");
    setInput("");
    const optimistic: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      structured_content: null,
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const reply = await askTutor(text, session);
      setSession(reply.session_id);
      selected.current = reply.session_id;
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: reply.message,
          structured_content: reply,
        },
      ]);
      setSessions(await tutorSessions(user!.id));
      void refresh();
    } catch (e) {
      setMessages((m) => m.filter((v) => v.id !== optimistic.id));
      setInput(text);
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function open(id: string) {
    if (busy) return;
    selected.current = id;
    setSession(id);
    setOpening(true);
    setError("");
    try {
      const value = await tutorMessages(id);
      if (selected.current === id) setMessages(value);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setOpening(false);
    }
  }
  function newChat() {
    if (busy) return;
    selected.current = null;
    setSession(null);
    setMessages([]);
    setError("");
  }
  return (
    <>
      <PageHeading
        eyebrow="A TUTOR THAT LEARNS WITH YOU"
        title="A little guidance goes a long way."
        description="Your words. Your learning story. A conversation that connects them."
      />
      <div className="tutor-layout">
        <div className="mobile-conversation-picker">
          <label>
            Pick up a conversation
            <select
              aria-label="Choose a tutor conversation"
              value={session || ""}
              disabled={busy || opening}
              onChange={(event) =>
                event.target.value ? void open(event.target.value) : newChat()
              }
            >
              <option value="">A new conversation</option>
              {sessions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <section className="chat-panel">
          <div className="chat-header">
            <span className="tutor-mark small">
              <Sparkles size={19} />
            </span>
            <div>
              <strong>Lexi, your vocabulary tutor</strong>
              <span>Here to help your words feel familiar.</span>
            </div>
            <span className="chat-status">
              <span className={`dot ${online ? "green" : "coral"}`} />
              {online ? "Ready to connect" : "Offline"}
            </span>
            <button
              className="icon-button"
              aria-label="Start a new tutor conversation"
              onClick={newChat}
              disabled={busy}
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="chat-messages">
            {opening ? (
              <div className="loading">
                <Loader2 className="spin" />
                Opening conversation…
              </div>
            ) : messages.length ? (
              messages.map((message) => (
                <div
                  className={`chat-message ${message.role}`}
                  key={message.id}
                >
                  {message.role === "assistant" && (
                    <span className="message-avatar">
                      <Sparkles size={16} />
                    </span>
                  )}
                  <div>
                    <div className="message-bubble">{message.content}</div>
                    {message.structured_content && (
                      <ReplyActions
                        reply={message.structured_content}
                        onSend={(text) => void send(undefined, text)}
                        disabled={busy || !online}
                      />
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="chat-welcome">
                <span className="chat-welcome-star">✦</span>
                <h2>
                  Let’s make those
                  <br />
                  words feel like yours.
                </h2>
                <p>
                  Ask about a meaning, practise a sentence, or find a word you
                  almost remember. I’ll work with your saved vocabulary and
                  learning history.
                </p>
                <div className="prompt-grid">
                  {prompts.map((p) => (
                    <button
                      key={p.title}
                      onClick={() => void send(undefined, p.text)}
                      disabled={busy || !online}
                    >
                      <span>{p.title}</span>
                      <ArrowUpRight size={16} />
                      <p>{p.text}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {busy && (
              <div className="chat-message assistant">
                <span className="message-avatar">
                  <Sparkles size={16} />
                </span>
                <div className="thinking" role="status">
                  <span />
                  <span />
                  <span />
                  <small>Connecting the dots…</small>
                </div>
              </div>
            )}
            <div ref={bottom} />
          </div>
          <ErrorNotice message={error} />
          <form className="chat-composer" onSubmit={(e) => void send(e)}>
            <textarea
              aria-label="Message your tutor"
              placeholder="A word, a question, a little uncertainty…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              maxLength={2000}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              className="button primary icon-only"
              aria-label="Send message"
              disabled={busy || opening || !input.trim() || !online}
            >
              <Send size={20} />
            </button>
          </form>
          <div className="chat-footnote">
            AI can make mistakes. Dictionary sources and your saved history
            ground the conversation.
          </div>
        </section>
        <aside className="conversations">
          <button
            className="button secondary wide"
            onClick={newChat}
            disabled={busy}
          >
            <Plus size={18} />A new conversation
          </button>
          <p className="eyebrow">YOUR CONVERSATIONS</p>
          {sessions.length ? (
            sessions.map((s) => (
              <button
                key={s.id}
                className={`conversation-item ${session === s.id ? "selected" : ""}`}
                onClick={() => void open(s.id)}
                disabled={busy}
              >
                <MessageSquare size={16} />
                <span>{s.title}</span>
              </button>
            ))
          ) : (
            <p className="subtle">Your conversations will appear here.</p>
          )}
          <div className="tutor-context-note">
            <Sparkles size={20} />
            <h3>More than a definition.</h3>
            <p>
              Lexi retrieves relevant meanings, reviews, and learning scores to
              help you practise what you need.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
function ReplyActions({
  reply,
  onSend,
  disabled,
}: {
  reply: TutorReply;
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  return (
    <>
      {reply.exercise && (
        <div className="tutor-exercise">
          <p className="eyebrow">LET’S TRY IT</p>
          <p>{reply.exercise.question}</p>
          <Link
            className="text-link"
            to={`/review?sense=${reply.exercise.sense_id}&type=${reply.exercise.type}`}
          >
            Open a practice exercise <ArrowRight size={15} />
          </Link>
        </div>
      )}
      {reply.suggestions.length > 0 && (
        <div className="suggestion-chips">
          {reply.suggestions.map((s) => (
            <button key={s} onClick={() => onSend(s)} disabled={disabled}>
              {s}
              <ArrowUpRight size={13} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
