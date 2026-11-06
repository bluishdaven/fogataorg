import type { ReactNode } from "react";

/*
 * Share-preview cards (1200×630), rendered by next/og. Only flexbox and inline styles work here,
 * and every element with more than one child needs display: flex. Colors are the light theme's.
 */

const C = {
  paper: "#faf6ee",
  card: "#fffdf8",
  ink: "#1d1a16",
  muted: "#6b5f50",
  ember: "#e8590c",
  emberText: "#b13a0a",
  emberSoft: "#fde4d0",
  border: "#e6dccb",
};

function Frame({ children, flame }: { children: ReactNode; flame: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: C.paper,
        fontFamily: "Inter",
        color: C.ink,
        position: "relative",
      }}
    >
      <div style={{ height: 10, width: "100%", background: C.ember, display: "flex" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "56px 72px 48px" }}>{children}</div>
      <div
        style={{
          position: "absolute",
          right: 72,
          bottom: 44,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 28,
          fontWeight: 600,
          color: C.emberText,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={flame} width={40} height={40} />
        fogata.org
      </div>
    </div>
  );
}

/** The general Fogata link: the flame, the name and the tagline. */
export function SiteCard({ flame, tagline }: { flame: string; tagline: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: C.paper,
        fontFamily: "Inter",
        color: C.ink,
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 10, background: C.ember, display: "flex" }} />
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={flame} width={190} height={190} />
      <div style={{ fontFamily: "Source Serif", fontWeight: 600, fontSize: 104, marginTop: 8, letterSpacing: -1 }}>Fogata</div>
      <div style={{ fontSize: 34, color: C.muted, marginTop: 12, maxWidth: 900, textAlign: "center", lineHeight: 1.35 }}>
        {tagline}
      </div>
      <div style={{ position: "absolute", bottom: 44, fontSize: 28, fontWeight: 600, color: C.emberText }}>fogata.org</div>
    </div>
  );
}

/** A story without a usable picture: the flame, the title and who wrote it. */
export function StoryCard({
  flame,
  title,
  subtitle,
  author,
  meta,
}: {
  flame: string;
  title: string;
  subtitle: string;
  author: string;
  meta: string;
}) {
  return (
    <Frame flame={flame}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "Source Serif", fontWeight: 600, fontSize: 34 }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={flame} width={48} height={48} />
        Fogata
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 40 }}>
        <div
          style={{
            fontFamily: "Source Serif",
            fontWeight: 600,
            fontSize: title.length > 70 ? 60 : 72,
            lineHeight: 1.12,
            letterSpacing: -0.5,
            display: "block",
            lineClamp: 3,
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 32, color: C.muted, marginTop: 20, lineHeight: 1.35, display: "block", lineClamp: 2 }}>{subtitle}</div>
        ) : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 30, maxWidth: 680 }}>
        <div style={{ fontWeight: 600 }}>{author}</div>
        <div style={{ color: C.muted, fontSize: 26, marginTop: 4 }}>{meta}</div>
      </div>
    </Frame>
  );
}

/** A person's profile: photo (or initials), name, handle, bio and what they've written. */
export function ProfileCard({
  flame,
  photo,
  initials,
  name,
  handle,
  bio,
  stats,
}: {
  flame: string;
  photo: string | null;
  initials: string;
  name: string;
  handle: string;
  bio: string;
  stats: string;
}) {
  return (
    <Frame flame={flame}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 60, paddingBottom: 40 }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={photo} width={280} height={280} style={{ borderRadius: 9999, border: `6px solid ${C.card}` }} />
        ) : (
          <div
            style={{
              width: 280,
              height: 280,
              borderRadius: 9999,
              background: C.emberSoft,
              color: C.emberText,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Source Serif",
              fontWeight: 600,
              fontSize: 110,
            }}
          >
            {initials}
          </div>
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ fontFamily: "Source Serif", fontWeight: 600, fontSize: name.length > 24 ? 58 : 68, lineHeight: 1.1, display: "block", lineClamp: 2 }}>
            {name}
          </div>
          <div style={{ fontSize: 30, color: C.muted, marginTop: 10 }}>{handle}</div>
          {bio ? <div style={{ fontSize: 30, lineHeight: 1.4, marginTop: 24, display: "block", lineClamp: 3 }}>{bio}</div> : null}
          {stats ? <div style={{ fontSize: 30, fontWeight: 600, color: C.emberText, marginTop: 24 }}>{stats}</div> : null}
        </div>
      </div>
    </Frame>
  );
}
