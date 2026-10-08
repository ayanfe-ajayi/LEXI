import { test, expect } from "@playwright/test";
import { signedIn, wordIds, names } from "./fixtures";

test("phonetic guide and remembered speed control drive browser speech", async ({
  page,
}) => {
  await signedIn(page, { accent: "English", ipa: "/ˈmaɪzə/", audio_url: null });
  await page.addInitScript(() => {
    (window as any).__spokenRates = [];
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance: SpeechSynthesisUtterance) {
          (window as any).__spokenRates.push(utterance.rate);
        },
      },
    });
  });
  await page.goto(`/words/${wordIds[0]}`);
  await expect(page.getByText("/ˈmaɪzə/", { exact: true })).toBeVisible();
  await expect(page.getByText("MY-zuh", { exact: true })).toBeVisible();
  const speed = page.getByRole("combobox", {
    name: `Pronunciation speed for ${names[0]}`,
  });
  await expect(speed).toHaveValue("1");
  for (const rate of ["0.7", "1", "1.3"]) {
    await speed.selectOption(rate);
    await page
      .getByRole("button", { name: `Hear ${names[0]}`, exact: true })
      .click();
  }
  const rates: number[] = await page.evaluate(() => (window as any).__spokenRates);
  expect(rates).toHaveLength(3);
  rates.forEach((rate, i) => expect(rate).toBeCloseTo([0.7, 1, 1.3][i], 5));
  await page.reload();
  await expect(speed).toHaveValue("1.3");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/pronunciation-${test.info().project.name}.png`,
  });
});

test("speed applies to dictionary audio and survives speech fallback", async ({
  page,
}) => {
  await signedIn(page, {
    accent: "English",
    ipa: "/ˈmaɪzə/",
    audio_url: "https://audio.example.test/miser.mp3",
  });
  await page.addInitScript(() => {
    (window as any).__audioRates = [];
    (window as any).__spokenRates = [];
    (window as any).Audio = class {
      playbackRate = 1;
      preservesPitch = true;
      pause() {}
      play() {
        (window as any).__audioRates.push(this.playbackRate);
        return Promise.reject(new Error("Test unavailable audio"));
      }
    };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance: SpeechSynthesisUtterance) {
          (window as any).__spokenRates.push(utterance.rate);
        },
      },
    });
  });
  await page.goto(`/words/${wordIds[0]}`);
  await page
    .getByRole("combobox", { name: `Pronunciation speed for ${names[0]}` })
    .selectOption("0.7");
  await page
    .getByRole("button", { name: `Hear ${names[0]}`, exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__spokenRates[0]))
    .toBeCloseTo(0.7, 5);
  expect(await page.evaluate(() => (window as any).__audioRates)).toEqual([
    0.7,
  ]);
});
