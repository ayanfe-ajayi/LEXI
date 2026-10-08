import { test, expect } from "@playwright/test";
import { signedIn } from "./fixtures";
test("production PWA can reload cached private routes offline with an expired token", async ({
  page,
  context,
}) => {
  await signedIn(page);
  await page.goto("/dashboard");
  await expect(page.getByText("Words collected")).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await expect(page.getByText("Words collected")).toBeVisible();
  await page.waitForFunction(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("keyval-store");
      r.onsuccess = () => resolve(r.result);
    });
    if (!db.objectStoreNames.contains("keyval")) return false;
    return new Promise((resolve) => {
      const r = db
        .transaction("keyval")
        .objectStore("keyval")
        .get("lexi:snapshot:11111111-1111-4111-8111-111111111111");
      r.onsuccess = () => resolve(Boolean(r.result));
    });
  });
  const manifest = await (
    await page.request.get("/manifest.webmanifest")
  ).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(2);
  await context.setOffline(true);
  await page.goto("/vocabulary");
  await expect(page.getByText(/You’re offline/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "meticulous", exact: true }),
  ).toBeVisible();
  const session = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("sb-pgxbzcsplpjtbvmtifta-auth-token")!)
        .expires_at,
  );
  expect(session).toBeLessThan(Date.now() / 1000);
  await context.setOffline(false);
});
