/**
 * Splits a paragraph into pieces of a sentence or so (at most ~220 characters) for speech: some
 * browsers stop long utterances partway, and short pieces let pausing and speed changes act fast.
 */
export function speechChunks(text: string, max = 220): string[] {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return [];
  const sentences = flat.match(/[^.!?…]+(?:[.!?…]+["”»’)]*|$)\s*/g) ?? [flat];
  const chunks: string[] = [];
  let current = "";
  const push = (piece: string) => {
    if (piece.trim()) chunks.push(piece.trim());
  };
  for (const sentence of sentences) {
    if (sentence.length > max) {
      push(current);
      current = "";
      // A very long sentence breaks at commas, then at spaces.
      let rest = sentence;
      while (rest.length > max) {
        const window = rest.slice(0, max);
        const cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(" "));
        const at = cut > max / 3 ? cut + 1 : max;
        push(rest.slice(0, at));
        rest = rest.slice(at);
      }
      current = rest;
    } else if ((current + sentence).length > max) {
      push(current);
      current = sentence;
    } else {
      current += sentence;
    }
  }
  push(current);
  return chunks;
}
