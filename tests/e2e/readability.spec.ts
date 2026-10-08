import { test, expect } from "@playwright/test";
import { signedIn, wordIds } from "./fixtures";

test("larger typography fits app pages and settings fields stack", async ({
  page,
}) => {
  await signedIn(page);
  for (const route of [
    "dashboard",
    "vocabulary",
    `words/${wordIds[0]}`,
    "review",
    "search",
    "tutor",
    "progress",
    "settings",
  ]) {
    await page.goto(`/${route}`);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator(".loading")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `${route} fits viewport`,
    ).toBe(true);
  }
  const start = await page.getByLabel("Quiet hours begin").boundingBox();
  const end = await page.getByLabel("Quiet hours end").boundingBox();
  expect(end!.y).toBeGreaterThan(start!.y + start!.height);
  expect(Math.abs(start!.x - end!.x)).toBeLessThan(2);
  expect(
    await page
      .getByLabel("Daily review limit")
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  expect(
    await page
      .getByRole("button", { name: "Save my preferences" })
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(15);
  await page.screenshot({
    path: `test-results/settings-readable-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.goto("/dashboard");
  await expect(page.getByText("Words collected")).toBeVisible();
  await page.screenshot({
    path: `test-results/dashboard-readable-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("installed PWA blocks zoom gestures but permits scrolling", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "standalone", {
      configurable: true,
      value: true,
    }),
  );
  await signedIn(page);
  await page.goto("/settings");
  await expect(page.locator("html")).toHaveClass(/pwa-standalone/);
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /user-scalable=no/,
  );
  const behavior = await page.evaluate(() => {
    const pinch = new Event("touchmove", { cancelable: true, bubbles: true });
    Object.defineProperty(pinch, "touches", { value: [{}, {}] });
    document.dispatchEvent(pinch);
    const scroll = new Event("touchmove", { cancelable: true, bubbles: true });
    Object.defineProperty(scroll, "touches", { value: [{}] });
    document.dispatchEvent(scroll);
    const gesture = new Event("gesturestart", { cancelable: true });
    document.dispatchEvent(gesture);
    return {
      pinch: pinch.defaultPrevented,
      scroll: scroll.defaultPrevented,
      gesture: gesture.defaultPrevented,
      touchAction: getComputedStyle(document.body).touchAction,
    };
  });
  expect(behavior).toEqual({
    pinch: true,
    scroll: false,
    gesture: true,
    touchAction: "pan-x pan-y",
  });
  await page.evaluate(() => window.scrollTo(0, 300));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("regular browser retains zoom", async ({ page }) => {
  await signedIn(page);
  await page.goto("/dashboard");
  await expect(page.locator("html")).not.toHaveClass(/pwa-standalone/);
  await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute(
    "content",
    /user-scalable=no/,
  );
  expect(
    await page.evaluate(() => {
      const event = new Event("gesturestart", { cancelable: true });
      document.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(false);
});
