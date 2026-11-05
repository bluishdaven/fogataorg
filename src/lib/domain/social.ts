import { z } from "zod";

/** Rules for social writes. Message keys live under `Social.errors`. */

export const MAX_SPARKS = 50;
export const RESPONSE_MAX = 4000;
const BLOCK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const followSchema = z.object({
  target: z.enum(["user", "topic", "circle"]),
  id: z.uuid(),
  follow: z.boolean(),
});

export const sparksSchema = z.object({
  storyId: z.uuid(),
  count: z.number().int().min(0).max(MAX_SPARKS),
});

export const bookmarkSchema = z.object({ storyId: z.uuid(), saved: z.boolean() });

export const responseSchema = z.object({
  storyId: z.uuid(),
  parentId: z.uuid().nullable(),
  blockId: z.string().regex(BLOCK_ID).nullable(),
  body: z
    .string()
    .transform((value) => value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim())
    .pipe(z.string().min(1, { message: "empty" }).max(RESPONSE_MAX, { message: "tooLong" })),
});
export type ResponseInput = z.input<typeof responseSchema>;

export const responseIdSchema = z.uuid();

/** Splits response text into plain text and @mentions for rendering. */
export function splitMentions(body: string): ({ type: "text"; value: string } | { type: "mention"; handle: string })[] {
  const parts: ({ type: "text"; value: string } | { type: "mention"; handle: string })[] = [];
  const pattern = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{3,30})/g;
  let last = 0;
  for (const match of body.matchAll(pattern)) {
    const start = (match.index ?? 0) + (match[1]?.length ?? 0);
    if (start > last) parts.push({ type: "text", value: body.slice(last, start) });
    parts.push({ type: "mention", handle: match[2]! });
    last = start + 1 + match[2]!.length;
  }
  if (last < body.length) parts.push({ type: "text", value: body.slice(last) });
  return parts;
}

/** Plain text of each top-level block, keyed by block id, for paragraph-anchored responses. */
export function blockTexts(doc: { content?: { attrs?: Record<string, unknown>; content?: { text?: string }[] }[] }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const block of doc.content ?? []) {
    const id = block.attrs?.id;
    if (typeof id !== "string" || !BLOCK_ID.test(id)) continue;
    const text = (block.content ?? []).map((child) => child.text ?? "").join("").trim();
    if (text) out[id] = text;
  }
  return out;
}
