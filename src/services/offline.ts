import { get, set, del, keys } from "idb-keyval";
import type { Snapshot, ReviewSubmission } from "../types";
import { submitReview } from "./review";
const snapshotKey = (user: string) => `lexi:snapshot:${user}`;
const queuePrefix = (user: string) => `lexi:review:${user}:`;
export async function queuedReviews(user: string) {
  const entries = (await keys()).filter(
    (key) => typeof key === "string" && key.startsWith(queuePrefix(user)),
  );
  const reviews = await Promise.all(
    entries.map((key) => get<ReviewSubmission>(key)),
  );
  return reviews.filter((review): review is ReviewSubmission =>
    Boolean(review),
  );
}
export function cachedSnapshot(user: string) {
  return get<Snapshot>(snapshotKey(user));
}
export function cacheSnapshot(user: string, value: Snapshot) {
  return set(snapshotKey(user), value);
}
export async function clearUserCache(user: string) {
  const entries = (await keys()).filter(
    (key) => typeof key === "string" && key.startsWith(queuePrefix(user)),
  );
  await Promise.all([
    del(snapshotKey(user)),
    ...entries.map((key) => del(key)),
  ]);
}
export async function enqueueReview(user: string, review: ReviewSubmission) {
  await set(`${queuePrefix(user)}${review.request_id}`, review);
}
export async function pendingReviews(user: string) {
  return (await queuedReviews(user)).length;
}
export async function syncReviews(user: string) {
  const queue = await queuedReviews(user);
  for (const review of queue) {
    await submitReview(review, user);
    await del(`${queuePrefix(user)}${review.request_id}`);
  }
}
