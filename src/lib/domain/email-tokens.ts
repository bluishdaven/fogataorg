import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, non-expiring tokens for one-click unsubscribe links. They identify
 * the reader without a session and can't be forged without the secret.
 * Format: base64url(userId).base64url(HMAC-SHA256(secret, "unsubscribe:" + userId)).
 */

const PURPOSE = "unsubscribe:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function sign(userId: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(PURPOSE + userId).digest();
}

export function createUnsubscribeToken(userId: string, secret: string): string {
  if (!secret) throw new Error("Missing email signing secret");
  return `${Buffer.from(userId).toString("base64url")}.${sign(userId, secret).toString("base64url")}`;
}

/** Returns the user id, or null if the token is malformed or forged. */
export function verifyUnsubscribeToken(token: unknown, secret: string): string | null {
  if (typeof token !== "string" || !secret || token.length > 200) return null;
  const [idPart, signaturePart, extra] = token.split(".");
  if (!idPart || !signaturePart || extra !== undefined) return null;
  const userId = Buffer.from(idPart, "base64url").toString("utf8");
  if (!UUID.test(userId)) return null;
  const expected = sign(userId, secret);
  const actual = Buffer.from(signaturePart, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? userId : null;
}

/** Constant-time comparison for shared secrets such as the cron bearer token. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
