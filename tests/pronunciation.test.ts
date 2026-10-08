import { describe, expect, it } from "vitest";
import { readablePronunciation } from "../src/lib/pronunciation";

describe("approximate English pronunciation guide", () => {
  it.each([
    ["/ˈmaɪzə/", "MY-zuh"],
    ["/ˈmaɪ.zər/", "MY-zuhr"],
    ["/həˈləʊ/", "huh-LOH"],
    ["/kæt/", "kat"],
    ["/ˈtʃiːp/", "CHEEP"],
    ["/aɪ/", "eye"],
  ])("converts %s with vowel sounds and stress", (ipa, expected) => {
    expect(readablePronunciation(ipa)).toBe(expected);
  });
  it("does not invent pronunciation when IPA is missing or unsupported", () => {
    expect(readablePronunciation("")).toBeNull();
    expect(readablePronunciation("/χ/")).toBeNull();
  });
});
