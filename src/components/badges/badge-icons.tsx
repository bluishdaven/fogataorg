import type { WritingTierKey } from "@/lib/domain/badges";

/**
 * Badge artwork, built from the Fogata flame. Tiers 1–7 stay in ember and the flame grows;
 * tiers 8–10 turn gold (fire in the sky, then legend). Decorative: UserBadges labels them.
 */

const OUTER =
  "M16 1c1.2 6.4 6.6 9.6 9.8 15.2 3.6 6.4 2.3 14.4-3.2 18.6A11.5 11.5 0 0 1 4.3 30C1.8 23.8 4.6 18.4 8 15.2c.4 3 1.9 5 4.2 6C10.6 14.4 12.8 6.6 16 1Z";
const INNER =
  "M16.5 17c.6 3.6 3.9 5.4 4.6 9a6.3 6.3 0 0 1-12.2 3.2c-.7-2.9.6-5.3 2.4-6.8.3 1.6 1.1 2.6 2.4 3.1-.6-3.4.8-6.4 2.8-8.5Z";

const EMBER = "#e8590c";
const DEEP = "#c2410c";
const GLOW = "#ffd27a";
const GOLD = "#ba7517";
const CREAM = "#fff7e6";

function Flame({ x = 0, y = 0, s = 1, fill = EMBER, glow = false }: { x?: number; y?: number; s?: number; fill?: string; glow?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={OUTER} fill={fill} />
      {glow ? <path d={INNER} fill={GLOW} /> : null}
    </g>
  );
}

const ART: Record<WritingTierKey, { viewBox: string; body: React.ReactNode }> = {
  kindling: {
    viewBox: "0 0 32 40",
    body: <path d={OUTER} fill="none" stroke={EMBER} strokeWidth={3} strokeLinejoin="round" />,
  },
  candle: {
    viewBox: "0 0 32 40",
    body: (
      <>
        <Flame x={6} s={0.62} />
        <rect x={10.5} y={24} width={11} height={15} rx={2} fill="#d9c7aa" />
      </>
    ),
  },
  flame: { viewBox: "0 0 32 40", body: <Flame /> },
  torch: {
    viewBox: "0 0 32 40",
    body: (
      <>
        <Flame x={5} s={0.66} glow />
        <path d="M12 26h8l-2 13.5h-4Z" fill="#8a5a36" />
      </>
    ),
  },
  hearth: { viewBox: "0 0 32 40", body: <Flame glow /> },
  bonfire: {
    viewBox: "0 0 42 40",
    body: (
      <>
        <Flame x={-2} y={6} s={0.8} fill={DEEP} />
        <Flame x={10} glow />
      </>
    ),
  },
  beacon: {
    viewBox: "0 0 40 40",
    body: (
      <>
        <circle cx={20} cy={20} r={18} fill="none" stroke={EMBER} strokeWidth={3} />
        <Flame x={9.5} y={6.5} s={0.66} glow />
      </>
    ),
  },
  star: {
    viewBox: "0 0 40 40",
    body: (
      <>
        <path d="M20 1.5l5.3 11.6 12.7 1.2-9.6 8.5 2.8 12.5L20 28.8 8.8 35.3l2.8-12.5L2 14.3l12.7-1.2Z" fill={GOLD} />
        <Flame x={14} y={13} s={0.38} fill={CREAM} />
      </>
    ),
  },
  sun: {
    viewBox: "0 0 40 40",
    body: (
      <>
        <g stroke={GOLD} strokeWidth={3} strokeLinecap="round">
          <path d="M20 2v5M20 33v5M2 20h5M33 20h5M7.3 7.3l3.5 3.5M29.2 29.2l3.5 3.5M7.3 32.7l3.5-3.5M29.2 10.8l3.5-3.5" />
        </g>
        <circle cx={20} cy={20} r={10.5} fill={GOLD} />
        <Flame x={15} y={12.2} s={0.31} fill={CREAM} />
      </>
    ),
  },
  phoenix: {
    viewBox: "0 0 48 40",
    body: (
      <>
        <path
          d="M24 31C14 31 6 23 2 10c8 4 14 6 19 6-4-4-5-9-4-14 3 6 5 9 7 10 2-1 4-4 7-10 1 5 0 10-4 14 5 0 11-2 19-6-4 13-12 21-22 21Z"
          fill={GOLD}
        />
        <Flame x={18} y={17} s={0.4} />
      </>
    ),
  },
};

export function TierIcon({ tier, className }: { tier: WritingTierKey; className?: string }) {
  const art = ART[tier];
  return (
    <svg viewBox={art.viewBox} className={className} aria-hidden focusable="false">
      {art.body}
    </svg>
  );
}

const HEART =
  "M20 42.5C13.2 37.6 6.5 32 6.5 25.2c0-4.5 3.3-7.7 7.2-7.7 2.7 0 4.9 1.5 6.3 3.8 1.4-2.3 3.6-3.8 6.3-3.8 3.9 0 7.2 3.2 7.2 7.7 0 6.8-6.7 12.4-13.5 17.3Z";
const CRIMSON = "#c8233f";

/** The donor badge: a heart in flames. The cream outline keeps the heart apart from the fire. */
export function DonorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 44" className={className} aria-hidden focusable="false">
      <Flame x={1.76} y={6} s={0.6} fill={DEEP} />
      <g transform="translate(38.24 6) scale(-0.6 0.6)">
        <path d={OUTER} fill={DEEP} />
      </g>
      <Flame x={7.2} s={0.8} glow />
      <g transform="translate(20 42.5) scale(0.88) translate(-20 -42.5)">
        <path d={HEART} fill={CRIMSON} stroke={CREAM} strokeWidth={2.05} strokeLinejoin="round" paintOrder="stroke" />
      </g>
    </svg>
  );
}
