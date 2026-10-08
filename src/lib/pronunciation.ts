// An approximate reading aid for common English IPA, not a replacement for IPA/audio.
const vowels: Record<string, string> = {
  aɪ: "y",
  aʊ: "ow",
  eɪ: "ay",
  oʊ: "oh",
  əʊ: "oh",
  ɔɪ: "oy",
  ɪə: "eer",
  eə: "air",
  ɛə: "air",
  ʊə: "oor",
  i: "ee",
  ɪ: "i",
  ɛ: "eh",
  e: "eh",
  æ: "a",
  ɑ: "ah",
  ɒ: "o",
  ɔ: "aw",
  ʌ: "uh",
  ə: "uh",
  ɜ: "ur",
  ɝ: "ur",
  ɚ: "er",
  u: "oo",
  ʊ: "u",
};
const consonants: Record<string, string> = {
  tʃ: "ch",
  dʒ: "j",
  p: "p",
  b: "b",
  t: "t",
  d: "d",
  k: "k",
  g: "g",
  ɡ: "g",
  f: "f",
  v: "v",
  θ: "th",
  ð: "th",
  s: "s",
  z: "z",
  ʃ: "sh",
  ʒ: "zh",
  h: "h",
  m: "m",
  n: "n",
  ŋ: "ng",
  l: "l",
  ɫ: "l",
  r: "r",
  ɹ: "r",
  j: "y",
  w: "w",
  ɾ: "t",
  ʔ: "",
  ɐ: "uh",
};
const symbols = [...Object.keys(vowels), ...Object.keys(consonants)].sort(
  (a, b) => b.length - a.length,
);
const onsets = new Set([
  "pl",
  "pr",
  "bl",
  "br",
  "tr",
  "dr",
  "kl",
  "kr",
  "gl",
  "gr",
  "fl",
  "fr",
  "sl",
  "sm",
  "sn",
  "sp",
  "st",
  "sk",
  "sw",
  "tw",
  "kw",
  "str",
  "spr",
  "skr",
  "spl",
  "skw",
  "θr",
  "ʃr",
]);

export function readablePronunciation(ipa: string): string | null {
  const cleaned = ipa.normalize("NFC").replace(/[\/\[\]ːˑ͡\s]/gu, "");
  if (!cleaned) return null;
  const result: string[] = [];
  let stressed = false;
  for (const part of cleaned.split(/([ˈˌ.])/u)) {
    if (part === "ˈ") {
      stressed = true;
      continue;
    }
    if (part === "ˌ" || part === ".") {
      stressed = false;
      continue;
    }
    if (!part) continue;
    const tokens: string[] = [];
    for (let position = 0; position < part.length;) {
      const token = symbols.find((symbol) => part.startsWith(symbol, position));
      if (!token) return null; // Keep IPA only when this notation isn't supported.
      tokens.push(token);
      position += token.length;
    }
    const nuclei = tokens.flatMap((token, i) => (token in vowels ? [i] : []));
    if (!nuclei.length) return null;
    let start = 0;
    for (let i = 0; i < nuclei.length; i++) {
      let end = tokens.length;
      if (i + 1 < nuclei.length) {
        const next = nuclei[i + 1];
        const between = tokens.slice(nuclei[i] + 1, next);
        let onsetLength = between.length ? 1 : 0;
        for (let length = 2; length <= between.length; length++) {
          const cluster = between
            .slice(-length)
            .join("")
            .replaceAll("ɹ", "r")
            .replaceAll("ɡ", "g");
          if (onsets.has(cluster)) onsetLength = length;
        }
        end = next - onsetLength;
      }
      const syllable = tokens
        .slice(start, end)
        .map((token, index) =>
          token === "aɪ" && index === 0
            ? "eye"
            : (vowels[token] ?? consonants[token]),
        )
        .join("");
      result.push(stressed && i === 0 ? syllable.toUpperCase() : syllable);
      start = end;
    }
    stressed = false;
  }
  return result.length ? result.join("-") : null;
}
