/**
 * The home page headline changes on every visit. All of them are in the page (so it stays
 * static and cached); an inline script picks one before the first paint and CSS shows it.
 */

/** Must match the length of `Home.headlines` in both message files (a unit test checks). */
export const HEADLINE_COUNT = 12;

export const HEADLINE_STORAGE_KEY = "fogata:headline";

/**
 * A random headline index, different from the last visit's when there was one.
 * `random` is in [0, 1), like Math.random().
 */
export function pickHeadline(count: number, last: number | null, random: number): number {
  const valid = last !== null && Number.isInteger(last) && last >= 0 && last < count && count > 1;
  const index = Math.floor(random * (valid ? count - 1 : count));
  return valid && index >= last ? index + 1 : index;
}

/**
 * `pickHeadline` as a self-contained inline script (no imports: it's serialized as text).
 * Sets `<html data-headline="i">` and remembers `i` so the next visit gets another one.
 * Without storage it still picks at random; without JavaScript the first headline shows.
 */
export const HEADLINE_SCRIPT = `(function(){var n=${HEADLINE_COUNT},k=${JSON.stringify(
  HEADLINE_STORAGE_KEY,
)},l=-1,s=null;try{s=window.localStorage;l=parseInt(s.getItem(k),10)}catch(e){}var v=l>=0&&l<n&&n>1,i=Math.floor(Math.random()*(v?n-1:n));if(v&&i>=l)i++;document.documentElement.setAttribute("data-headline",String(i));try{if(s)s.setItem(k,String(i))}catch(e){}})();`;

/** CSS that shows only the picked headline (the first one when nothing was picked). */
export function headlineCss(count: number = HEADLINE_COUNT): string {
  const rules = ["[data-headline-option]{display:none}", 'html:not([data-headline]) [data-headline-option="0"]{display:inline}'];
  for (let i = 0; i < count; i += 1) {
    rules.push(`html[data-headline="${i}"] [data-headline-option="${i}"]{display:inline}`);
  }
  return rules.join("");
}
