import type messages from "../messages/en.json";
import type { Locale } from "@/lib/domain/locale";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
