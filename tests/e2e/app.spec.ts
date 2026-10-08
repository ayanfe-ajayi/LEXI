import { test, expect } from "@playwright/test";
import { signedIn, names, wordIds, senseIds, definitions } from "./fixtures";
test("offline review syncs exactly once after reconnection", async ({
  page,
  context,
}) => {
  await signedIn(page);
  const submissions: unknown[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/functions/v1/review"))
      submissions.push(request.postDataJSON());
  });
  await page.goto("/review");
  await expect(
    page.getByRole("button", { name: /Very careful about details/ }),
  ).toBeVisible();
  await context.setOffline(true);
  await page
    .getByRole("button", { name: /Very careful about details/ })
    .click();
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(
    page.getByText("Nicely done. This review will sync when you reconnect."),
  ).toBeVisible();
  expect(submissions).toHaveLength(0);
  await page.getByRole("link", { name: "Come back to this later" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/1 reviews will sync/)).toBeVisible();
  await context.setOffline(false);
  await expect.poll(() => submissions.length).toBe(1);
  await page.waitForFunction(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("keyval-store");
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise((resolve) => {
      const r = db.transaction("keyval").objectStore("keyval").getAllKeys();
      r.onsuccess = () =>
        resolve(
          !r.result.some((key) => String(key).startsWith("lexi:review:")),
        );
    });
  });
  expect(submissions).toHaveLength(1);
});
test("sign-out removes the device’s private vocabulary cache and offline identity", async ({
  page,
}) => {
  await signedIn(page);
  await page.goto("/dashboard");
  await expect(page.getByText("Words collected")).toBeVisible();
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back.", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("lexi:offline-user:pgxbzcsplpjtbvmtifta"),
    ),
  ).toBeNull();
  const cached = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open("keyval-store");
      r.onsuccess = () => resolve(r.result);
    });
    return new Promise((resolve) => {
      const r = db
        .transaction("keyval")
        .objectStore("keyval")
        .get("lexi:snapshot:11111111-1111-4111-8111-111111111111");
      r.onsuccess = () => resolve(Boolean(r.result));
    });
  });
  expect(cached).toBe(false);
});
test("welcome and sign-in have real navigation and accessible forms", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Discover it. Save it. Make it yours." }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/welcome-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Start your next chapter" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByLabel("Your name")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "minlength",
    "8",
  );
  expect(errors).toEqual([]);
});
test("unauthenticated users cannot open private routes", async ({ page }) => {
  await page.goto("/vocabulary");
  await expect(page).toHaveURL(/\/login$/);
});
test("dashboard and vocabulary show authenticated data and filter correctly", async ({
  page,
}, info) => {
  await signedIn(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: /Good .*Alex/ }),
  ).toBeVisible();
  await expect(page.getByText("Words collected")).toBeVisible();
  await page.screenshot({
    path: `test-results/dashboard-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/vocabulary");
  await expect(page.getByRole("heading", { name: "meticulous" })).toBeVisible();
  await page.getByLabel("Search saved words").fill("awkward");
  await expect(page.getByRole("heading", { name: "cumbersome" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "meticulous" }),
  ).not.toBeVisible();
  await page.getByLabel("Search saved words").fill("");
  await page.getByRole("button", { name: /Mastered/ }).click();
  await expect(
    page.getByRole("heading", { name: "inadvertently" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "cumbersome" }),
  ).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("add-word flow previews and saves a backend entry", async ({ page }) => {
  await signedIn(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Add a word", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("The word", { exact: true }).fill("meticulous");
  await page.getByRole("button", { name: "Explore this word" }).click();
  await expect(
    page.getByRole("button", { name: "Keep this word" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep this word" }).click();
  await expect(page).toHaveURL(new RegExp(`/words/${wordIds[0]}`));
  await expect(
    page.getByRole("heading", { name: "meticulous", exact: true }),
  ).toBeVisible();
});
test("recognition and reverse recall submit distinct idempotency keys", async ({
  page,
}) => {
  await signedIn(page);
  const submissions: any[] = [];
  page.on("request", (req) => {
    if (req.url().endsWith("/functions/v1/review"))
      submissions.push(req.postDataJSON());
  });
  await page.goto("/review");
  await page
    .getByRole("button", { name: /Very careful about details/ })
    .click();
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(
    page.getByRole("heading", { name: "That’s it. Nicely done!" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next word" }).click();
  await page.getByLabel("Your answer").fill("Cumbersome!");
  await page.getByRole("button", { name: "Check my answer" }).click();
  await expect(
    page.getByRole("heading", { name: "That’s it. Nicely done!" }),
  ).toBeVisible();
  expect(submissions).toHaveLength(2);
  expect(submissions[0].request_id).not.toBe(submissions[1].request_id);
  expect(submissions[1].type).toBe("reverse_recall");
});
test("meaning search and tutor use backend results; tutor exercise opens a real sense", async ({
  page,
}) => {
  await signedIn(page);
  await page.goto("/search");
  await page.getByLabel("Describe a word’s meaning").fill("without intending");
  await page.getByRole("button", { name: "Find my word" }).click();
  await expect(
    page.getByRole("heading", { name: "inadvertently" }),
  ).toBeVisible();
  await page.goto("/tutor");
  await page
    .getByLabel("Message your tutor")
    .fill("Help me practise meticulous");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/You recognise its meaning/)).toBeVisible();
  await page.getByRole("link", { name: "Open a practice exercise" }).click();
  await expect(
    page.getByRole("heading", { name: "Use “meticulous” in a sentence." }),
  ).toBeVisible();
});
test("cached vocabulary remains available offline", async ({
  page,
  context,
}) => {
  await signedIn(page);
  await page.goto("/dashboard");
  await expect(page.getByText("Words collected")).toBeVisible();
  await page.waitForFunction(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("keyval-store");
      r.onsuccess = () => resolve(r.result);
      r.onerror = reject;
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
  await context.setOffline(true);
  await expect(page.getByText(/You’re offline/)).toBeVisible();
  await page.getByRole("link", { name: "All my words" }).click();
  await expect(page).toHaveURL(/\/vocabulary$/);
  await expect(
    page.getByRole("heading", { name: "meticulous", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
});
test("settings and progress render without horizontal overflow", async ({
  page,
}) => {
  await signedIn(page);
  for (const route of ["/progress", "/settings", "/words/" + wordIds[0]]) {
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    await expect(
      page.getByRole("status", { name: "Loading your words…" }),
    ).not.toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
