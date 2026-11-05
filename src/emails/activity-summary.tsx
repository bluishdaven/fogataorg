import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

/**
 * Activity summary email. Plain, readable, and light on markup so it renders
 * in every client; all copy arrives already translated.
 */

export type ActivitySummaryProps = {
  lang: "en" | "es";
  preview: string;
  heading: string;
  intro: string;
  items: { text: string; href: string }[];
  more: string | null;
  cta: { label: string; href: string };
  footer: { why: string; settingsLabel: string; settingsHref: string; unsubscribeLabel: string; unsubscribeHref: string };
};

const colors = { paper: "#faf6ee", card: "#fffdf8", ink: "#1d1a16", muted: "#6b5f50", ember: "#b13a0a", border: "#e6dccb" };

export function ActivitySummaryEmail({ lang, preview, heading, intro, items, more, cta, footer }: ActivitySummaryProps) {
  return (
    <Html lang={lang}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.paper, margin: 0, padding: "24px 12px", fontFamily: "Georgia, 'Times New Roman', serif", color: colors.ink }}>
        <Container style={{ maxWidth: 520, margin: "0 auto", backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 28 }}>
          <Text style={{ fontSize: 26, margin: "0 0 4px" }}>🔥</Text>
          <Heading as="h1" style={{ fontSize: 22, lineHeight: "28px", margin: "0 0 8px" }}>
            {heading}
          </Heading>
          <Text style={{ fontSize: 15, lineHeight: "22px", color: colors.muted, margin: "0 0 16px" }}>{intro}</Text>
          <Section>
            {items.map((item, index) => (
              <Text key={index} style={{ fontSize: 16, lineHeight: "24px", margin: "0 0 12px" }}>
                <Link href={item.href} style={{ color: colors.ink, textDecoration: "underline" }}>
                  {item.text}
                </Link>
              </Text>
            ))}
            {more ? <Text style={{ fontSize: 14, color: colors.muted, margin: "0 0 12px" }}>{more}</Text> : null}
          </Section>
          <Section style={{ margin: "20px 0 4px" }}>
            <Link
              href={cta.href}
              style={{
                backgroundColor: colors.ember,
                color: "#ffffff",
                padding: "11px 18px",
                borderRadius: 8,
                fontFamily: "Helvetica, Arial, sans-serif",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              {cta.label}
            </Link>
          </Section>
          <Hr style={{ borderColor: colors.border, margin: "24px 0 12px" }} />
          <Text style={{ fontSize: 12, lineHeight: "18px", color: colors.muted, margin: 0, fontFamily: "Helvetica, Arial, sans-serif" }}>
            {footer.why}{" "}
            <Link href={footer.settingsHref} style={{ color: colors.muted }}>
              {footer.settingsLabel}
            </Link>{" "}
            ·{" "}
            <Link href={footer.unsubscribeHref} style={{ color: colors.muted }}>
              {footer.unsubscribeLabel}
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
