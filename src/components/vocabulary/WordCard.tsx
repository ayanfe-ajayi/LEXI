import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { UserWord, Progress } from "../../types";
import { average, relativeDate } from "../../lib/utils";
export function WordCard({
  word,
  progress,
  compact = false,
}: {
  word: UserWord;
  progress: Progress[];
  compact?: boolean;
}) {
  const sense = word.words.word_senses[0];
  const scores = progress.filter((p) =>
    word.words.word_senses.some((s) => s.id === p.sense_id),
  );
  const next = scores.map((p) => p.next_review_at).sort()[0];
  return (
    <Link
      to={`/words/${word.word_id}`}
      className={`word-card ${compact ? "compact" : ""}`}
    >
      <div className="word-card-top">
        <span className="word-pos">{sense?.part_of_speech || "WORD"}</span>
        <span className={`status-tag ${word.status}`}>
          {word.status === "new" ? "Just discovered" : word.status}
        </span>
      </div>
      <h3>
        {word.words.word}
        <ArrowUpRight size={19} />
      </h3>
      <p>{sense?.simple_definition}</p>
      {!compact && (
        <div className="word-card-footer">
          <span>{next ? relativeDate(next) : "Ready to learn"}</span>
          <span className="mini-score">
            <span
              style={{
                width: `${average(scores.map((p) => p.recall_score))}%`,
              }}
            />
          </span>
          <strong>{average(scores.map((p) => p.recall_score))}% recall</strong>
        </div>
      )}
    </Link>
  );
}
