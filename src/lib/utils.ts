import type { Snapshot } from "../types";
export function relativeDate(date: string) {
  const d = new Date(date);
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  return days <= 0
    ? "Due now"
    : days === 1
      ? "Tomorrow"
      : days < 7
        ? `In ${days} days`
        : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function dateLabel(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
export function initials(name: string) {
  return (
    name
      .split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "L"
  );
}
export function average(values: number[]) {
  return values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : 0;
}
export function localDay(date: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}
export function learningStats(data: Snapshot) {
  const active = data.words.filter((w) => w.status !== "archived");
  const senses = new Set(
    active.flatMap((w) => w.words.word_senses.map((s) => s.id)),
  );
  const progress = data.progress.filter((p) => senses.has(p.sense_id));
  const reviews = data.reviews.filter((r) => senses.has(r.sense_id));
  const timezone = data.profile?.timezone || "Africa/Lagos";
  const today = localDay(new Date().toISOString(), timezone);
  const dates = new Set(reviews.map((r) => localDay(r.created_at, timezone)));
  let streak = 0;
  const day = new Date();
  if (!dates.has(today)) day.setDate(day.getDate() - 1);
  for (let i = 0; i < 366; i++) {
    if (!dates.has(localDay(day.toISOString(), timezone))) break;
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return {
    saved: active.length,
    mastered: active.filter((w) => w.status === "mastered").length,
    due: progress.filter(
      (p) => new Date(p.next_review_at).getTime() <= Date.now(),
    ).length,
    weak: progress.filter((p) => p.times_forgotten > 0 && p.recall_score < 60)
      .length,
    accuracy: reviews.length
      ? Math.round(
          (reviews.filter((r) => r.result).length / reviews.length) * 100,
        )
      : 0,
    streak,
    reviews: reviews.length,
    today: reviews.filter((r) => localDay(r.created_at, timezone) === today)
      .length,
    progress,
  };
}
