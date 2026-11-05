import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { WRITING_TIERS } from "@/lib/domain/badges";
import { notificationMessage, notificationPath, type NotificationItem, type SocialTranslator } from "@/lib/domain/notification-text";

function translator(messages: typeof en | typeof es, locale: "en" | "es"): SocialTranslator {
  const t = createTranslator({ locale, messages, namespace: "Social" });
  return (key, values) => (t as unknown as SocialTranslator)(key, values);
}

const badge = (key: string, type: "badge" | "donor" = "badge"): NotificationItem => ({
  type,
  actor: null,
  others: 0,
  story: null,
  responseExcerpt: null,
  circle: null,
  badge: { key, username: "dana" },
});

describe("badge notifications", () => {
  it("name the tier and what it took", () => {
    expect(notificationMessage(translator(en, "en"), badge("kindling"))).toBe(
      "You earned the Kindling badge: your first published story. Keep the fire going!",
    );
    expect(notificationMessage(translator(en, "en"), badge("bonfire"))).toBe(
      "You earned the Bonfire badge: 100 published stories. Keep the fire going!",
    );
    expect(notificationMessage(translator(es, "es"), badge("candle"))).toBe(
      "Ganaste la insignia Vela: 5 historias publicadas. ¡Que no se apague el fuego!",
    );
  });

  it("thank donors", () => {
    expect(notificationMessage(translator(en, "en"), badge("donor", "donor"))).toBe(
      "You're a Firekeeper! Thank you for supporting Fogata with a donation.",
    );
    expect(notificationMessage(translator(es, "es"), badge("donor", "donor"))).toBe(
      "¡Ya eres Mecenas! Gracias por apoyar a Fogata con una donación.",
    );
  });

  it("use the same tier names as the badges themselves", () => {
    for (const [messages, locale] of [
      [en, "en"],
      [es, "es"],
    ] as const) {
      for (const tier of WRITING_TIERS) {
        expect(notificationMessage(translator(messages, locale), badge(tier.key))).toContain(messages.Badges.tiers[tier.key]);
      }
    }
  });

  it("link to the writer's profile, where the badges show", () => {
    expect(notificationPath(badge("flame"), "en")).toBe("/@dana");
    expect(notificationPath(badge("donor", "donor"), "es")).toBe("/@dana");
  });
});
