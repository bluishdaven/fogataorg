import { describe, expect, it } from "vitest";
import { clientIp, isLoopback, isNewAccount, LIMITS, limitFor } from "@/lib/domain/limits";

const now = new Date("2026-11-07T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("rate limits", () => {
  it("treat accounts as new for their first day", () => {
    expect(isNewAccount(hoursAgo(2), now)).toBe(true);
    expect(isNewAccount(hoursAgo(23.9), now)).toBe(true);
    expect(isNewAccount(hoursAgo(25), now)).toBe(false);
    expect(isNewAccount(null, now)).toBe(true);
  });

  it("give new accounts the tighter limit where there is one", () => {
    expect(limitFor("publish", hoursAgo(1), now)).toEqual(LIMITS.publish.newAccount);
    expect(limitFor("publish", hoursAgo(48), now)).toEqual(LIMITS.publish.regular);
    expect(limitFor("signInLink", hoursAgo(1), now)).toEqual(LIMITS.signInLink.regular);
    for (const rule of Object.values(LIMITS)) {
      if (rule.newAccount && rule.newAccount.per === rule.regular.per) expect(rule.newAccount.max).toBeLessThan(rule.regular.max);
    }
  });

  it("read the visitor's address from the first forwarded hop", () => {
    expect(clientIp("203.0.113.7, 10.0.0.1", null)).toBe("203.0.113.7");
    expect(clientIp(null, " 198.51.100.2 ")).toBe("198.51.100.2");
    expect(clientIp(null, null)).toBeNull();
    expect(clientIp("", null)).toBeNull();
  });

  it("leave requests from this machine out of per-address limits", () => {
    for (const ip of ["127.0.0.1", "::1", "::ffff:127.0.0.1", "127.1.2.3"]) expect(isLoopback(ip)).toBe(true);
    for (const ip of ["203.0.113.7", "2001:db8::1", "10.0.0.1", "128.0.0.1"]) expect(isLoopback(ip)).toBe(false);
  });
});
