import type { Locale } from "../locale";

const SPANISH = new Set("que de el la los las y en un una por con para es no se del lo como más pero su al está muy sus le ya o fue este esta yo también hay porque cuando sin sobre entre".split(" "));
const ENGLISH = new Set("the and of to in is that it for was with as on but you not this be are have at they my his her he she we an or from by all were would there their which".split(" "));

/** Spanish or English, from how many common words of each a text uses; `fallback` when unsure. */
export function guessLanguage(text: string, fallback: Locale = "en"): Locale {
  let es = 0;
  let en = 0;
  for (const word of text.toLowerCase().match(/[a-záéíóúüñ]+/g)?.slice(0, 2_000) ?? []) {
    if (SPANISH.has(word)) es += 1;
    if (ENGLISH.has(word)) en += 1;
  }
  if (es + en < 5) return fallback;
  return es > en ? "es" : "en";
}
