import "server-only";

/**
 * Checks a Turnstile token with Cloudflare. Without TURNSTILE_SECRET_KEY (local and test builds)
 * there's nothing to check. A missing or rejected token fails; if Cloudflare can't be reached we let
 * the request through rather than lock everyone out (rate limits still apply).
 */
export async function verifyTurnstile(token: string | null, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return true;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    console.error("[auth] Turnstile verification unavailable");
    return true;
  }
}
