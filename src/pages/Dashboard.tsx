import {
  ArrowRight,
  Plus,
  Sparkles,
  BookOpen,
  Target,
  Flame,
  ArrowUpRight,
} from "lucide-react";
import { Link, useOutletContext } from "react-router-dom";
import { useData } from "../app/providers/DataProvider";
import { useAuth } from "../app/providers/AuthProvider";
import { learningStats } from "../lib/utils";
import { Spinner, SectionHeading, Empty } from "../components/ui";
import { WordCard } from "../components/vocabulary/WordCard";
export function Dashboard() {
  const { data, loading } = useData();
  const { user } = useAuth();
  const { openAdd } = useOutletContext<{ openAdd: () => void }>();
  if (loading) return <Spinner />;
  const stats = learningStats(data);
  const name = (
    data.profile?.display_name ||
    user?.user_metadata.display_name ||
    "word explorer"
  ).split(" ")[0];
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: data.profile?.timezone || "Africa/Lagos",
    }).format(new Date()),
  );
  const recent = data.words.filter((w) => w.status !== "archived").slice(0, 3);
  const challenge = recent[0];
  return (
    <>
      <header className="dashboard-greeting">
        <div>
          <p className="eyebrow">
            <span className="dot coral" /> YOUR DAILY DOSE OF DISCOVERY
          </p>
          <h1>
            Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"},{" "}
            {name}
            <span className="greeting-spark">✦</span>
          </h1>
          <p className="subtitle">
            A little practice today. A richer vocabulary tomorrow.
          </p>
        </div>
        <div className="greeting-date">
          {new Date().toLocaleDateString(undefined, { weekday: "long" })}
          <span>
            {new Date().toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </header>
      <div className="dashboard-grid">
        <section className="daily-review-card">
          <div className="review-card-copy">
            <p className="eyebrow">YOUR DAILY REVIEW</p>
            <h2>
              <span>{stats.due}</span>word{" "}
              {stats.due === 1 ? "sense" : "senses"}
              <br />
              ready to revisit.
            </h2>
            <p>
              {stats.due
                ? `${stats.weak ? `${stats.weak} could use a little extra attention. ` : ""}Let’s make them stick.`
                : stats.saved
                  ? "You’re all caught up. A quick practice keeps things fresh."
                  : "Your next discovery starts here. Save a word to begin."}
            </p>
            <Link
              className="button primary"
              to={stats.due ? "/review" : stats.saved ? "/quiz" : "/vocabulary"}
            >
              {stats.due
                ? "Start my review"
                : stats.saved
                  ? "Try a quick practice"
                  : "Find my first word"}
              <ArrowRight size={18} />
            </Link>
            <div className="review-time">
              <span className="dot purple" />
              {stats.due
                ? `About ${Math.max(1, Math.ceil(Math.min(stats.due, data.preferences?.daily_limit || 10) / 2))} minutes. You’ve got this.`
                : "Small steps. Lasting progress."}
            </div>
          </div>
          <div className="review-illustration" aria-hidden="true">
            <div className="orbit-line" />
            <div className="review-mini-card card-back">
              <span>re·mem·ber</span>
              <i />
            </div>
            <div className="review-mini-card card-front">
              <span className="mini-label">ONE WORD AT A TIME</span>
              <BookOpen size={40} strokeWidth={1.4} />
              <span>Make it yours.</span>
              <div className="mini-check">✓</div>
            </div>
            <span className="art-star star-a">✦</span>
            <span className="art-star star-b">✧</span>
            <span className="art-dot" />
          </div>
        </section>
        <section className="tutor-promo">
          <span className="tutor-mark">
            <Sparkles size={24} />
          </span>
          <p className="eyebrow">A LITTLE HELP FROM LEXI</p>
          <h2>
            It’s on the tip <br />
            of your tongue.
          </h2>
          <p>
            Know the meaning, but can’t find the word? Let’s connect the dots.
          </p>
          <Link className="button ghost-light" to="/search">
            Find a word by meaning <ArrowUpRight size={18} />
          </Link>
          <Link className="tutor-promo-link" to="/tutor">
            Or have a chat with your tutor <ArrowRight size={14} />
          </Link>
          <span className="promo-star" aria-hidden="true">
            ✦
          </span>
        </section>
      </div>
      <section className="stats-strip">
        <div className="stat-item">
          <span className="stat-icon">
            <BookOpen size={20} />
          </span>
          <div>
            <strong>{stats.saved}</strong>
            <span>Words collected</span>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon green">
            <Target size={20} />
          </span>
          <div>
            <strong>{stats.mastered}</strong>
            <span>Words mastered</span>
          </div>
        </div>
        <div className="stat-item">
          <span className="stat-icon coral">
            <Flame size={20} />
          </span>
          <div>
            <strong>
              {stats.streak}
              <small> days</small>
            </strong>
            <span>Your practice streak</span>
          </div>
        </div>
        <Link className="stats-link" to="/progress">
          Your progress
          <ArrowUpRight size={19} />
        </Link>
      </section>
      <section>
        <SectionHeading
          title="Your recent discoveries"
          to="/vocabulary"
          label="All my words"
        />
        {recent.length ? (
          <div className="word-grid recent-grid">
            {recent.map((w) => (
              <WordCard key={w.id} word={w} progress={data.progress} compact />
            ))}
          </div>
        ) : (
          <div className="panel">
            <Empty
              title="Every collection starts with one word."
              description="Found an unfamiliar word in a movie, a book, or a conversation? Give it a home here."
              action={
                <button className="button primary" onClick={openAdd}>
                  <Plus size={18} />
                  Add my first word
                </button>
              }
            />
          </div>
        )}
      </section>
      <div className="dashboard-bottom">
        <section className="challenge-card">
          <p className="eyebrow">
            <Sparkles size={15} /> TODAY’S LITTLE CHALLENGE
          </p>
          <h2>
            {challenge ? (
              <>
                Make “{challenge.words.word}”<br />
                part of your day.
              </>
            ) : (
              <>
                Notice a new word
                <br />
                in your everyday world.
              </>
            )}
          </h2>
          <p>
            {challenge
              ? "Try using it in a sentence. A word you use is a word you remember."
              : "Listen closely, read a little, and save a word that catches your attention."}
          </p>
          {challenge ? (
            <Link
              className="text-link"
              to={`/review?word=${challenge.word_id}&type=usage`}
            >
              Give it a try <ArrowRight size={17} />
            </Link>
          ) : (
            <button className="text-link" onClick={openAdd}>
              Keep a discovery <ArrowRight size={17} />
            </button>
          )}
        </section>
        <section className="learning-note">
          <span className="quote-mark">“</span>
          <blockquote>
            The more words you know,
            <br />
            the more clearly you can
            <br />
            <em>say what you mean.</em>
          </blockquote>
          <p>A LITTLE REMINDER FROM LEXI</p>
          <span className="note-spark">✦</span>
        </section>
      </div>
    </>
  );
}
