import { test, expect } from "@playwright/test";
import { signedIn, senseIds, wordIds } from "./fixtures";
test("unchecking saved vocabulary requests and displays broader verified words", async ({
  page,
}) => {
  await signedIn(page);
  const requests: boolean[] = [];
  await page.route("**/functions/v1/reverse-search", async (route) => {
    const mine = route.request().postDataJSON().mine;
    requests.push(mine);
    await route.fulfill({
      json: {
        results: [
          {
            sense_id: senseIds[0],
            word_id: wordIds[0],
            word: mine ? "meticulous" : "clandestinely",
            part_of_speech: "adverb",
            definition: "Done secretly.",
            simple_definition: "Done secretly.",
            in_vocabulary: mine,
            discovered_at: null,
            score: 1,
          },
        ],
        explanation: "",
        mode: mine ? "hybrid" : "discovery",
        notice: "",
      },
    });
  });
  await page.goto("/search");
  await page.getByLabel("Describe a word’s meaning").fill("done secretly");
  await page.getByRole("button", { name: "Find my word" }).click();
  await expect(
    page.getByRole("heading", { name: "meticulous", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search only my saved vocabulary").uncheck();
  await expect(
    page.getByRole("heading", { name: "meticulous", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Find my word" }).click();
  await expect(
    page.getByRole("heading", { name: "clandestinely", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Broader word suggestions", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("In your vocabulary", { exact: false }),
  ).toHaveCount(0);
  expect(requests).toEqual([true, false]);
});
test("empty relevant results and restricted AI coverage are shown clearly", async ({
  page,
}) => {
  await signedIn(page);
  await page.route("**/functions/v1/reverse-search", async (route) => {
    await route.fulfill({
      json: {
        results: [],
        explanation: "No verified meaning fits.",
        mode: "text",
        notice: "Broader word suggestions are temporarily unavailable.",
      },
    });
  });
  await page.goto("/search");
  await page.getByLabel("Search only my saved vocabulary").uncheck();
  await page
    .getByLabel("Describe a word’s meaning")
    .fill("no matching meaning");
  await page.getByRole("button", { name: "Find my word" }).click();
  await expect(page.getByText("No matching word senses yet.")).toBeVisible();
  await expect(
    page
      .getByRole("status")
      .filter({
        hasText: "Broader word suggestions are temporarily unavailable.",
      }),
  ).toBeVisible();
});
