import { useState } from "react";
import { useSearchParams, useOutletContext } from "react-router-dom";
import { Plus, Search, SlidersHorizontal, BookOpen } from "lucide-react";
import { useData } from "../app/providers/DataProvider";
import { WordCard } from "../components/vocabulary/WordCard";
import { PageHeading, Spinner, Empty } from "../components/ui";
import { average } from "../lib/utils";
export function Vocabulary() {
  const { data, loading } = useData();
  const { openAdd } = useOutletContext<{ openAdd: () => void }>();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "";
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  if (loading) return <Spinner />;
  const active = data.words.filter((w) => w.status !== "archived");
  const progressFor = (id: string) =>
    data.progress.filter((p) =>
      data.words
        .find((w) => w.word_id === id)
        ?.words.word_senses.some((s) => s.id === p.sense_id),
    );
  const words = data.words.filter(
    (w) =>
      (filter === "all" ? w.status !== "archived" : filter === w.status) &&
      (w.words.word.toLowerCase().includes(query.toLowerCase()) ||
        w.personal_note.toLowerCase().includes(query.toLowerCase()) ||
        w.words.word_senses.some((s) =>
          s.definition.toLowerCase().includes(query.toLowerCase()),
        )),
  );
  words.sort((a, b) =>
    sort === "alphabetical"
      ? a.words.word.localeCompare(b.words.word)
      : sort === "difficult"
        ? average(progressFor(a.word_id).map((p) => p.recall_score)) -
          average(progressFor(b.word_id).map((p) => p.recall_score))
        : sort === "due"
          ? (
              progressFor(a.word_id)
                .map((p) => p.next_review_at)
                .sort()[0] || ""
            ).localeCompare(
              progressFor(b.word_id)
                .map((p) => p.next_review_at)
                .sort()[0] || "",
            )
          : b.discovered_at.localeCompare(a.discovered_at),
  );
  return (
    <>
      <PageHeading
        eyebrow="YOUR GROWING COLLECTION"
        title="Words worth keeping."
        description="Every word has a story. These are yours."
        action={
          <button className="button primary" onClick={openAdd}>
            <Plus size={18} />
            Add a word
          </button>
        }
      />
      <div className="collection-banner">
        <BookOpen size={22} />
        <p>
          <strong>{active.length} little discoveries.</strong> A vocabulary that
          grows with you.
        </p>
        <span>✦</span>
      </div>
      <div className="vocabulary-toolbar">
        <div className="input-with-icon">
          <Search size={18} />
          <input
            aria-label="Search saved words"
            placeholder="Search your words, meanings, or notes…"
            value={query}
            onChange={(e) =>
              setParams(e.target.value ? { q: e.target.value } : {})
            }
          />
        </div>
        <div className="sort-control">
          <SlidersHorizontal size={17} />
          <select
            aria-label="Sort vocabulary"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">Recently discovered</option>
            <option value="due">Next review</option>
            <option value="difficult">Most difficult</option>
            <option value="alphabetical">A to Z</option>
          </select>
        </div>
      </div>
      <div className="filter-row" role="group" aria-label="Filter vocabulary">
        {[
          ["all", "All words"],
          ["new", "New"],
          ["learning", "Learning"],
          ["reviewing", "Reviewing"],
          ["mastered", "Mastered"],
          ["archived", "Archived"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`filter-pill ${filter === key ? "selected" : ""}`}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
            <span>
              {key === "all"
                ? active.length
                : data.words.filter((w) => w.status === key).length}
            </span>
          </button>
        ))}
      </div>
      <div className="results-label">
        {words.length} {words.length === 1 ? "word" : "words"} in this
        collection
      </div>
      {words.length ? (
        <div className="word-grid">
          {words.map((w) => (
            <WordCard key={w.id} word={w} progress={data.progress} />
          ))}
        </div>
      ) : (
        <div className="panel">
          <Empty
            title={
              query
                ? "No word found just yet."
                : filter === "all"
                  ? "Make room for your first discovery."
                  : "No words here yet."
            }
            description={
              query
                ? "Try another spelling, a meaning, or a personal note."
                : "Save words as you find them. We’ll help you remember what makes each one special."
            }
            action={
              <button className="button primary" onClick={openAdd}>
                <Plus size={18} />
                Add a word
              </button>
            }
          />
        </div>
      )}
    </>
  );
}
