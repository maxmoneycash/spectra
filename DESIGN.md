# SPECTRA — Design System

> Dark precision-instrument UI for a browser SDR lab. Design serves the task: the spectrum is the hero, chrome is quiet, motion communicates state.

## Register & dials

Product/tool UI (earned familiarity, not novelty). Audience: RF students, hams, SIGINT trainees, DSP devs — users fluent in pro tools (SDR++, iZotope RX, Tektronix).

`DESIGN_VARIANCE 5` (structured console, asymmetric deck groups) · `MOTION_INTENSITY 6` (springs on state changes; the canvas supplies the ambient motion) · `VISUAL_DENSITY 7` (cockpit-dense but breathable).

## Color

Strategy: **Restrained** — warm-tinted near-black neutrals + one ember accent used only for active / tuned / record states. Kind-coded signal colors come from `KIND_INFO` and appear only as data identity (detection carets, list dots, confidence bars) — never as chrome.

Tokens (`:root` in `src/index.css`, mirrored for canvas in `src/ui/theme.ts`):

| Role | Value |
|---|---|
| `--bg` / `--bg-elev` / `--stage` | `oklch(14/16.5/11.5% 0.005 60)` warm near-black |
| `--surface-1/2/3` | `oklch(19.5/23.5/28.5% 0.005-0.006 60)` |
| `--border` / `--border-strong` | white 7% / 14% |
| `--text` / `--text-2` / `--text-3` / `--text-faint` | `oklch(96/74/60/46%)` |
| `--accent` | `oklch(66% 0.19 38)` ember orange |
| `--accent-dim` / `--accent-line` | accent at 13% / 45% alpha |
| `--ok` family | green, grading feedback only |

Elevation: `--elev-1` (hairline shadow + inset top highlight), `--elev-2` (deep, popovers). No pure black, no glow-as-decoration.

## Typography

- **IBM Plex Sans** (300/400/500/600) for UI, **IBM Plex Mono** (400/500) for all data and readouts. Self-hosted via `@fontsource/*`; loaded in `src/main.tsx`.
- Fixed scale, not fluid: 10 / 10.5 / 11.5 / 12.5 / 13 (base). VFO readout 37px mono (28px on small screens).
- Micro-labels: mono 8–10px, uppercase, 0.14–0.16em tracking, `--text-faint`.

## Shape & layout

Radii: `--r-1` 6px (chips, small inputs) · `--r-2` 10px (buttons, segmented, wells) · `--r-3` 14px (cards, sheet, popovers) · pill for status/segmented-fill.

```
┌ TopBar 48px ─ brand · mission chip · transport · record · reveal · keys ─┐
├ Stage (flex-1) ─ spectrum + tuner scale + waterfall ────┬ Rail 360px ───┤
├ ReceiverDeck ~116px ─ VFO · Demod · Faders · S-meter · Scopes ──────────┤
└ StatusBar 28px ──────────────────────────────────────────────────────────┘
```

- App shell: CSS grid `48px / minmax(0,1fr) / auto / 28px`, single explicit column `minmax(0,1fr)` (prevents max-content track blowout on mobile).
- Breakpoints: **1279** rail 320px · **1199** deck scopes off · **1023** rail → bottom sheet, deck wraps to two rows · **719** compact topbar (play/record/reveal/panels only), deck three rows (VFO+meter / modes scroll / fader scroll), condensed statusbar.
- The stage is the product: maximum area, overlays float (display controls bottom-right, start overlay center).

## Components

- **VFO odometer** — per-digit spring slide (`popLayout`), click to type a frequency (Enter commits, Esc cancels).
- **Segmented / mode chips** — `layoutId` sliding pill, critically damped.
- **Fader** — custom pointer-capture slider: 3px rail, accent fill, thumb on hover/drag, `role="slider"`, arrows (Shift ×10).
- **Detection cards** — kind-color dot + confidence bar, click to tune, selected card expands in place (height spring) with identify chips + SNR history.
- **Bottom sheet** (mobile panels) — spring entrance, `drag="y"` dismiss with velocity handoff, scrim + Esc.
- **Stage canvases** — spectrum plot is DPR-scaled; waterfall stays 1x (ImageData row scroll). Tuner scale, detection carets, VFO needle + pill are canvas-drawn (see `SpectrumWaterfall.tsx`).

## Motion

- `framer-motion` with `MotionConfig reducedMotion="user"`; house spring `{ type:'spring', bounce:0, duration:0.4 }` (Apple critically-damped default). Bounce ≤0.45 reserved for objective checks / mission complete.
- Motion conveys state only: tab pill, panel crossfade, card expand, odometer digits, sheet drag, `whileTap` 0.9–0.94 on buttons, record pulse, live-dot pulse.
- High-rate data (spectrum, audio, IQ, meter) never enters React state — canvases subscribe to engine events imperatively.

## Accessibility

`prefers-reduced-motion` → crossfades/instant. `prefers-reduced-transparency` → solid overlays. Focus-visible accent rings. Sliders are keyboard-operable; sheet closes on Esc/scrim. Text contrast ≥4.5:1 (`--text-3` is the floor for small text).

## Academy view

Same instrument language, one tier airier: the log-spectrum explorer (`src/academy/LogAxis.tsx`) uses the stage palette, region ribbon + band blocks at 6px radius, and accent only for bands that exist in the simulator (▶). Explorer labels fade in by zoom level via collision-skipping (never overlapping). Lessons are 292px cards in a horizontal rail with 84px live canvas demos.

## QA

`node scripts/qa-shots.mjs` — drives Playwright through desktop (1440×900) and mobile (390×844) flows, fails on console errors, writes screenshots. `node scripts/docs-shots.mjs` — refreshes `docs/screenshots/`.
