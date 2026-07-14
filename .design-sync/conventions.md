# GINX Design System — usage conventions

GINX is a gym/fitness app. Its design system is **athletic and high-contrast**: a near-black
background, a single gold brand accent, and bold uppercase calls-to-action. Build every screen on a
dark surface — the components are designed for it and look wrong on white.

## Setup / wrapping

No provider or theme wrapper is required — components style themselves. Two things matter:

1. **Render on the dark app background.** Wrap your screens in a dark container, e.g.
   `<div style={{ background: '#121212', minHeight: '100vh' }}>`. The primary Button is a white fill
   and is invisible on a white page. (The shipped CSS carries surface utilities like `bg-gym-card`;
   for the page background itself use the `#121212` value directly.)
2. The bundle's stylesheet must be loaded (it ships as `styles.css`, which imports the compiled
   component CSS). All `gym-*` utility classes below come from it.

## Styling idiom

Two layers, both real in this system:

- **Components carry their own look through variant props** — you do NOT pass Tailwind classes to
  restyle them. Pick the variant/size that fits.
- **For your own layout glue** (spacing, grids, backgrounds) use the GINX color utilities. Verified
  classes in the shipped CSS:

  | Class | Meaning |
  |---|---|
  | `bg-gym-card` | elevated surface `#1e1e1e` (page bg `#121212` via inline style) |
  | `bg-gym-primary` / `text-gym-primary` / `border-gym-primary` | gold accent `#ffd700` |
  | `bg-gym-accent` / `border-gym-accent` | danger red `#ff4d4d` |
  | `text-gym-text` | default body text `#e0e0e0` |

  The `tokens` export also carries these as JS values (`tokens.color.primary === '#ffd700'`).

## Component API (import from the library / `window.GinxDS`)

- **Button** — `variant`: `primary` (white→gold hover, the main CTA) · `accent` (solid gold) ·
  `ghost` (gold-tinted outline) · `danger` (red). `size`: `sm|md|lg`. `block` for full width.
- **Card** — dark surface container. `padding`: `none|sm|md|lg`, `border`, `elevated`.
- **Input** — dark text field. `invalid` for the error state; standard input props otherwise.
- **Badge** — `variant`: `primary|soft|danger|neutral`. `size`: `dot` (round count bubble) · `sm` · `md`.
- **Modal** — overlay dialog. `open`, optional `onClose`, `title`, children as body. Renders its own
  dimmed full-screen backdrop.

Read each component's `<Name>.d.ts` for the full prop contract before styling.

## Idiomatic snippet

```tsx
<div style={{ background: '#121212', minHeight: '100vh', padding: 16 }}>
  <Card elevated>
    <div className="flex items-center justify-between">
      <span className="text-gym-text uppercase text-xs tracking-widest">Racha</span>
      <Badge>12 días</Badge>
    </div>
    <div className="text-gym-primary font-black text-4xl mt-2">1.240</div>
  </Card>
  <Button variant="accent" size="lg" block>Empezar entrenamiento</Button>
</div>
```
