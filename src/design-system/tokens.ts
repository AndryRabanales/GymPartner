/**
 * GINX design tokens — the source of truth for the design system's look.
 * Mirrors the `gym.*` palette in tailwind.config.js.
 */
export const tokens = {
  color: {
    primary: '#ffd700', // Gold — brand accent / CTA hover
    dark: '#121212', // App background
    card: '#1e1e1e', // Elevated surface
    text: '#e0e0e0', // Default foreground
    accent: '#ff4d4d', // Danger / destructive
    black: '#000000', // On-gold / on-white foreground
    white: '#ffffff', // Primary CTA fill
  },
  radius: {
    md: '0.75rem', // rounded-xl
    lg: '1rem', // rounded-2xl
    full: '9999px',
  },
  font: {
    weight: {
      body: '400',
      bold: '700',
      black: '900',
    },
    tracking: {
      wide: '0.1em',
      wider: '0.15em',
      widest: '0.2em', // tracking-[0.2em] — the signature CTA tracking
    },
  },
} as const;

export type Tokens = typeof tokens;
