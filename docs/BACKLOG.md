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

## 2. CTF result card — **done**

A compact, spoiler-free result image travels further than a link (the Wordle
lesson). Reuse the Operator Card renderer.

- [x] 10-cell grid of solved/unsolved, score, rank
- [x] No flag text in the image
- [x] Native share on mobile, clipboard elsewhere

## 3. Static routes for the signal library (SEO) — **done**

"What does LoRa look like on a waterfall" is a real query with weak answers.
Today none of this is indexable.

- [x] A route per signal type with its description, waterfall signature, real-world uses
- [x] Pre-rendered HTML with per-page title/meta/OG, plus sitemap.xml + robots.txt
- [x] Cross-links between signals and into the live receiver

## 4. Academy UI consistency — **partly done**

The last view still on its own dialect — its own tab treatment and card
patterns. Bring onto `BottomSheet` / `IconButton` / the reels rhythm.

- [x] Unify the tab treatments behind `UnderlineTabs` (top bar, console rail, Academy)
- [x] Deduplicate `GroupLabel` (deck now imports the shared one)
- [ ] One spacing scale across views — still outstanding
- [ ] Exam pool picker is a segmented control, not an underline strip; decide if that should converge
- [ ] Academy card/section patterns still differ from the reels

## 5. Second CTF challenge set

Content is the moat: challenges accumulate and can't be scraped out of a
competitor. Only worth building once set one has an audience.

---

## Standing quality bar

Every increment: `npx tsc --noEmit`, `npx vitest run`, `npm run build`, plus a
real browser check (`scripts/qa-*.mjs`) before commit. Ship to production and
verify against the live URL, not just localhost.

---

## Review findings — open

From a code-review pass over the recent surface. Fixed already: CW beacons
transmitted braces the Morse table cannot send (challenges were unsolvable),
and answer keys that accepted a spelling the UI never shows.

**Correctness, ranked**

- [x] **CTF scene discarded on first play.** FIXED — `sceneLoaded` flag; `start()` no longer clobbers a scene another view loaded.
      Was: `start()` reloads `scenarioId`
      when `audioStarted` is false, so opening a challenge (or a `?c=` link)
      then pressing play swaps in the default scenario while the store still
      reports the challenge's frequencies. `store.ts:174-186` vs
      `CtfView.tsx:181-188`.
- [x] **Reels blank + mis-grade after a queue rebuild.** FIXED — scroll reset now keyed on `queue` identity.
      Was: `resetProgress()`,
      re-tapping the current topic, or re-tapping the current pool reset
      `index` to 0 without resetting `scrollTop`; cards outside the ±3 window
      render `aria-hidden`, and A–D grades the off-screen `queue[0]`.
      `ExamView.tsx:286-288,392-394`.
- [x] **Submit wedges on a `checkFlag` throw.** FIXED — try/catch, and it now says why.
      Was: No try/catch around
      `crypto.subtle.digest`, which is undefined outside a secure context —
      `checking` never clears, Submit stays disabled. `ctf/store.ts:90-98`.
- [ ] **Sibling cards cancel live narration.** The inactive branch calls the
      global `cancelSpeech()`; on any index change a later sibling flushes the
      utterance queue. Masked today because all pools ship rendered clips.
      `ExamView.tsx:50-69`.
- [ ] **Canvas panels keep the old palette after a theme flip while stopped.**
      Draws are driven by engine events; only the waterfall is cleared. The
      spectrum plot, ruler, scopes and Academy `LogAxis` stay stale.
- [x] **`loadPool` drops a rapid second click** FIXED — concurrent calls allowed, latest-wins.
      Was: — bails on `loading` after
      already committing `pool`. Needs latest-wins.
- [x] **Deep-link `?topic=` is case-sensitive** FIXED — normalised, and a bare `?c=`/`?pool=` now implies its view.
      Was:, and a `?c=` link with no
      `view` param loses `c` on the first outbound write.
- [ ] `index.html` hardcodes `color-scheme: dark` while the theme defaults to
      light and ignores `prefers-color-scheme`.
- [ ] `render-narration.mjs` uses `new URL(...).pathname` for ROOT — breaks on
      repo paths containing spaces. Use `fileURLToPath`.

**Clean on review:** `urlState.ts`, `colormaps.ts`, CTF scoring/hints/
persistence, the exam spaced-repetition weighting, the narration manifest
logic, `controls.tsx`.

## Second CTF set — needs redoing

An agent produced 10 challenges then stalled mid-fix. The file carried ten
flag hashes and **no record of the intended answers**, and SHA-256 is one-way,
so not one challenge could be shown to be solvable. Discarded rather than
shipped — an unsolvable challenge set is worse than none, as the brace bug
just demonstrated.

If retried, the brief must require: the plaintext answers recorded alongside
the hashes, and a test proving each flag is reachable from the simulated
scene (for CW, through the real encode -> decode -> checkFlag chain).

Its one salvageable finding, worth keeping: CW emitters can read as
"continuous" mid-message, so a duty-cycle question about a CW signal would be
graded wrong.

## Intercept challenges — the operating layer

Several of the original ten could be answered by reading the Stations panel
without touching the receiver. The `intercept` category fixes that: the flag
is only *copyable* once the radio is set up correctly, so the answer itself
proves the operating and nothing has to inspect the user's settings.

Each is enforced by the DSP, not by a rule:

- **Split the Pair** — two CW beacons 350 Hz apart, inside the stock 500 Hz
  CW filter, so the copy interleaves into nonsense. `Receiver.buildChain`
  derives the channel filter from `bandwidthHz`, so narrowing genuinely
  rejects the neighbour.
- **Working the Input** — the flag is on a repeater's input, 600 kHz below
  the output you find first. Requires knowing the offset convention.
- **Below the Gate** — the beacon sits under the default squelch.
  `applySquelchAgc` runs before the worker's `decodeCW`, so a closed gate
  really does starve the decoder while the waterfall still shows the carrier.

The challenge sheet carries a live receiver strip (frequency, mode,
bandwidth, and what the decoder is copying right now) so wrong operating
reads as garbage and correct operating resolves into text as you work.

Next for this category: zero-beat tuning precision, catching one beacon in a
timed rotation, and copying through deliberate adjacent-channel splatter.
