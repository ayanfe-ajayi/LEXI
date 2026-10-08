import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Target,
  Flame,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { useData } from "../app/providers/DataProvider";
import { PageHeading, Spinner, Empty, Meter } from "../components/ui";
import { learningStats, average, localDay } from "../lib/utils";
export function ProgressPage() {
  const { data, loading } = useData();
  if (loading) return <Spinner />;
  const stats = learningStats(data);
  const timezone = data.profile?.timezone || "Africa/Lagos";
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const day = localDay(d.toISOString(), timezone);
    return {
      label: new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        timeZone: timezone,
      }).format(d),
      count: data.reviews.filter(
        (r) => localDay(r.created_at, timezone) === day,
      ).length,
    };
  });
  const max = Math.max(5, ...days.map((d) => d.count));
  const weak = stats.progress
    .filter((p) => p.times_reviewed > 0 && p.recall_score < 60)
    .sort((a, b) => a.recall_score - b.recall_score)
    .slice(0, 4);
  return (
    <>
      <PageHeading
        eyebrow="SMALL STEPS. REAL PROGRESS."
        title="Look how far your words have come."
        description="Every discovery, every attempt, every little moment of recall adds up."
      />
      <div className="progress-stats">
        {[
          {
            icon: BookOpen,
            value: stats.saved,
            label: "Words collected",
            note: "Little discoveries worth keeping",
          },
          {
            icon: Target,
            value: stats.mastered,
            label: "Words mastered",
            note: "Ready for your everyday vocabulary",
          },
          {
            icon: Flame,
            value: stats.streak,
            label: "Day streak",
            note: "Showing up makes a difference",
          },
          {
            icon: TrendingUp,
            value: `${stats.accuracy}%`,
            label: "Review accuracy",
            note: `Across ${stats.reviews} review attempts`,
          },
        ].map(({ icon: Icon, value, label, note }) => (
          <section className="panel progress-stat" key={label}>
            <span className="stat-icon">
              <Icon size={21} />
            </span>
            <strong>{value}</strong>
            <h3>{label}</h3>
            <p>{note}</p>
          </section>
        ))}
      </div>
      <div className="progress-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR PRACTICE RHYTHM</p>
              <h2>A little, every day.</h2>
            </div>
            <span className="soft-tag">Past 7 days</span>
          </div>
          <div
            className="activity-chart"
            role="img"
            aria-label={`Reviews over the last week: ${days.map((d) => `${d.label}: ${d.count}`).join(", ")}`}
          >
            {days.map((day, i) => (
              <div className={`chart-day ${i === 6 ? "today" : ""}`} key={i}>
                <strong>{day.count}</strong>
                <div className="chart-bar-space">
                  <span style={{ height: `${(day.count / max) * 100}%` }} />
                </div>
                <span>{day.label}</span>
              </div>
            ))}
          </div>
          <div className="chart-footnote">
            <span className="dot purple" />
            Reviews completed<span>{stats.today} today</span>
          </div>
        </section>
        <section className="panel">
          <p className="eyebrow">A FEW DIFFERENT WAYS TO KNOW A WORD</p>
          <h2>Your learning balance.</h2>
          <Meter
            label="Understanding meanings"
            value={average(stats.progress.map((p) => p.understanding_score))}
          />
          <Meter
            label="Recalling the word"
            value={average(stats.progress.map((p) => p.recall_score))}
          />
          <Meter
            label="Using it in a sentence"
            value={average(stats.progress.map((p) => p.usage_score))}
          />
          <Meter
            label="Spoken word recognition"
            value={average(stats.progress.map((p) => p.pronunciation_score))}
          />
          <p className="tiny-note">
            Scores grow through practice of each skill. Pronunciation practice
            checks a spoken transcript.
          </p>
        </section>
      </div>
      <section className="panel weak-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A LITTLE EXTRA ATTENTION</p>
            <h2>Words to get reacquainted with.</h2>
          </div>
          <Sparkles size={24} />
        </div>
        {weak.length ? (
          <div className="weak-words">
            {weak.map((p) => {
              const word = data.words.find((w) =>
                w.words.word_senses.some((s) => s.id === p.sense_id),
              );
              return word ? (
                <div className="weak-word" key={p.id}>
                  <div>
                    <strong>{word.words.word}</strong>
                    <p>
                      {p.times_forgotten} forgotten · {p.recall_score}% recall
                    </p>
                  </div>
                  <Link
                    className="text-link"
                    to={`/review?word=${word.word_id}`}
                  >
                    Practise <ArrowRight size={16} />
                  </Link>
                </div>
              ) : null;
            })}
          </div>
        ) : (
          <Empty
            title={
              stats.reviews
                ? "Your words are finding their feet."
                : "Your learning story starts with practice."
            }
            description="Words needing extra attention will appear here after you review them."
            action={
              <Link className="button secondary" to="/quiz">
                Try a little practice <ArrowRight size={16} />
              </Link>
            }
          />
        )}
      </section>
    </>
  );
}
