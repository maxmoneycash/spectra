# Execution backlog

Ordered worklist. Rationale for the ordering is in [`GROWTH.md`](./GROWTH.md).
Each item is shippable on its own and verified in a browser before it lands.

## 1. URL state / deep links — **done**

No part of the app is linkable today, so every mention of it anywhere has to
say "go to the site and click around." Cheapest growth feature available.

- [x] `?view=console|academy|exam|ctf` restores the view
- [x] `?c=<challenge-id>` opens a CTF challenge and loads its scene
- [x] `?pool=technician|general|extra` and `?topic=T1` for the reels
- [x] `?scenario=<id>` for the console
- [x] URL updates on navigation via `replaceState` (no history spam)
- [x] Unknown/malformed params fall back cleanly rather than white-screening

## 2. CTF result card — **next**

A compact, spoiler-free result image travels further than a link (the Wordle
lesson). Reuse the Operator Card renderer.

- [ ] 10-cell grid of solved/unsolved, score, rank
- [ ] No flag text in the image
- [ ] Download + copy-to-clipboard

## 3. Static routes for the signal library (SEO)

"What does LoRa look like on a waterfall" is a real query with weak answers.
Today none of this is indexable.

- [ ] A route per signal type with its description, waterfall signature, real-world uses
- [ ] Pre-rendered HTML with per-page title/meta/OG
- [ ] Cross-links into the live library

## 4. Academy UI consistency

The last view still on its own dialect — its own tab treatment and card
patterns. Bring onto `BottomSheet` / `IconButton` / the reels rhythm.

- [ ] Unify the three tab treatments (RailTabs, NavTab, exam pool picker)
- [ ] Deduplicate `GroupLabel`
- [ ] One spacing scale across views

## 5. Second CTF challenge set

Content is the moat: challenges accumulate and can't be scraped out of a
competitor. Only worth building once set one has an audience.

---

## Standing quality bar

Every increment: `npx tsc --noEmit`, `npx vitest run`, `npm run build`, plus a
real browser check (`scripts/qa-*.mjs`) before commit. Ship to production and
verify against the live URL, not just localhost.
