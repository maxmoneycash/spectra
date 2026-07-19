# SPECTRA — Design System

> The chanhdai.com idiom, applied to a working RF instrument: zinc-monochrome ruled chrome around an always-dark spectrum stage. Built on Tailwind CSS v4 + shadcn/ui (new-york), with audio components from ElevenLabs UI.

## Register

Product/tool UI in the chanhdai design language: **earned familiarity**, engineering-grid aesthetics. The stage (spectrum/waterfall) is the hero and stays dark in both themes; chrome is 100% zinc monochrome; **ember (#f5622f) survives only inside data** (waterfall LUT, VFO marker, IQ dots, SNR chart). Blue is for links only.

## Themes

Light default + dark, `.dark` class on `<html>`, persisted to `localStorage`, animated circle-reveal via the View Transitions API (`useTheme` in `src/hooks/useTheme.ts`). Scope a `.dark` wrapper around any always-dark well (e.g. the audio-visualizer box) to force dark tokens there in light mode.

## Tokens (oklch, chanhdai values — `src/index.css` + `tokens.css`)

| Token | Light | Dark |
|---|---|---|
| `--background` / `--foreground` | `#ffffff` / `#09090b` | `#09090b` / `#fafafa` |
| `--card`, `--popover` | `#ffffff` | `#18181b` |
| `--primary` | `#18181b` | `#fafafa` (inverted) |
| `--secondary`, `--muted`, `--accent` | `#f4f4f5` | `#27272a` |
| `--muted-foreground` | `#71717a` | `#a1a1aa` |
| `--border` | `#e4e4e7` | `#27272a` |
| `--line` (structural hairline) | `color-mix(border 64%, background)` | same |
| `--link` | blue-700 | blue-500 |
| `--stage` (+ `-foreground/-muted/-border`) | `#09090b` always | same |

## Typography

**Geist Sans** (UI) + **Geist Mono** (data, labels, readouts — `ss11`/`zero`/`tnum` via `.mono-feats`), self-hosted via `@fontsource/geist[-mono]`. Mono is a stylistic device: micro-labels at 8.5–10px uppercase with 0.14–0.16em tracking, all numeric readouts, kbd chips.

## Shape & layout

- **Structure is square** (panels, ruled grids, wells); **controls are rounded** (`--radius` 10px; sm 6 / md 8 / lg 10 / xl 14).
- **Ruled hairlines everywhere**: `--line` hairlines separate regions; `screen-line-top/bottom` full-bleed rules; `stripe-divider` pinstripe bands; `border-x` + `max-w-3xl` border-grid column on content pages (Academy).
- Console shell: 56px ruled navbar / full-width stage + 360–380px ruled rail / ruled receiver deck / 26px mono status bar. Mobile: rail → shadcn bottom sheet, deck condenses to VFO + modes + scrollable fader strip.
- Deck groups, rail lists, and grids use divide/border rules instead of cards (chanhdai "lined" idiom); cards appear only as wells around scopes/demos.

## Components (owned code — `src/components/ui/`)

- **shadcn**: button, badge, card, separator, slider, sheet, popover, tooltip, toggle-group, tabs, sonner, scroll-area, checkbox.
- **ElevenLabs UI** (vendored from github.com/elevenlabs/ui): `BarVisualizer` (deck audio spectrum, fed by a `MediaStreamDestination` tap on the engine's Web Audio graph), `Matrix` (dot-matrix S-meter VU), `waveform` + `live-waveform` (available; BarVisualizer covers the deck), MIT.
- **chanhdai idiom**: lined rows (Stations), lined grid (Library), metrics strip (mono numbers), underline tabs, kbd chips.
- **Custom**: `Fader` (pointer-capture slider), `Odometer` (rolling VFO digits), spectrum/waterfall/LogAxis canvases, IQ constellation.

## Motion

`motion/react` springs (`{bounce: 0, duration: 0.3–0.45}`), `MotionConfig reducedMotion="user"`: underline tabs (layoutId), panel crossfades, row expand, odometer digits, whileTap 0.94, view-transition theme reveal, animated objective checks. High-rate data (spectrum/audio/IQ/meter) never enters React state.

## Accessibility

`prefers-reduced-motion` respected globally; `prefers-reduced-transparency` solid overlays; focus-visible rings; sliders keyboard-operable; sheet focus-trapped (Radix); both themes pass AA for body text.

## QA

`npm run shots` (`scripts/qa-shots.mjs`) — Playwright flows on desktop + mobile; `scripts/qa-themes.mjs` — both themes; `scripts/docs-shots.mjs` — refreshes `docs/screenshots/`.
