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
- [x] **Sibling cards cancel live narration.** FIXED by the Listen-mode rewrite — only the active card registers a stop; inactive cards never touch the narrator.
      Was: The inactive branch calls the
      global `cancelSpeech()`; on any index change a later sibling flushes the
      utterance queue. Masked today because all pools ship rendered clips.
      `ExamView.tsx:50-69`.
- [x] **Canvas panels keep the old palette after a theme flip while stopped.** FIXED — spectrum/ruler (d21dd83), Academy `LogAxis`, and the IQ scope now repaint on a theme flip.
      Was:
      Draws are driven by engine events; only the waterfall is cleared. The
      spectrum plot, ruler, scopes and Academy `LogAxis` stay stale.
- [x] **`loadPool` drops a rapid second click** FIXED — concurrent calls allowed, latest-wins.
      Was: — bails on `loading` after
      already committing `pool`. Needs latest-wins.
- [x] **Deep-link `?topic=` is case-sensitive** FIXED — normalised, and a bare `?c=`/`?pool=` now implies its view.
      Was:, and a `?c=` link with no
      `view` param loses `c` on the first outbound write.
- [x] FIXED by the new shell — `color-scheme: light dark`, and `useTheme` sets it on every flip. Was: `index.html` hardcodes `color-scheme: dark` while the theme defaults to
      light and ignores `prefers-color-scheme`.
- [x] FIXED — `fileURLToPath`. Was: `render-narration.mjs` uses `new URL(...).pathname` for ROOT — breaks on
      repo paths containing spaces. Use `fileURLToPath`.

**Clean on review:** `urlState.ts`, `colormaps.ts`, CTF scoring/hints/
persistence, the exam spaced-repetition weighting, the narration manifest
logic, `controls.tsx`.

## Tracker: skirt flickers and chirp fragments counted as emitters — FIXED (2026-10-09)

Found by `src/ctf/recon.test.ts`, the first test to run the eight non-CW
challenges through scene → spectrum → detector → tracker → classifier
(`src/test/detectHarness.ts`, the worker's chain with its guess cache, plus an
"ever seen" ledger that counts a track only once it has been on the posted
list for ~170 ms). Measured: **First Light counted 8 emitters for 4** and
**ISM Census 10 for 5** — exactly what a player following the brief ("let it
accumulate") would have counted, so both recon flags were effectively
unreachable. Cause: the tracker's dedup radius came from the *candidate's*
bandwidth, so a 1 kHz flicker at a 138 kHz FM station's skirt (50 kHz out)
and the fragments a LoRa chirp sheds inside its own 125 kHz were never merged
into the station they belong to. Fix: the radius is the larger of the two
tracks' widths. After: 4/4 and 5/5; the chirper lists once instead of five
times. Fox Hunt reads 144.330, Carrier in the Clear reads 124.200, Diagonal
Rain offers LoRa, Which Sideband offers both sidebands.

Fixed (2026-10-09): the hopper listed as ~20 narrow "CW" entries, then — after
the first aggregator — as nine short-lived "FHSS" hoppers, because a comb's
span was whatever fragment matched it that frame and every re-formation minted
a new id. The tracker now folds every fragment touching a hopper's remembered
span into one track with one id, absorbed dwells extend the span, and the
classifier names FHSS first; recon.test.ts pins it on the hopper challenge.
Residue, documented in that test: dwells landing on the PSK's upper skirt
merge with it into 30–90 kHz blobs, so the ledger can hold the PSK twice.

Left honest, not fixed: the chirp-width panel over-reads a 125 kHz chirp as
~148 kHz because the remembered width spans the sweep — the challenge's
"standard channel widths" hint is what resolves it, and the test says so.

## Classifier: NFM voice read as AM, resting stations as CW — FIXED (2026-10-09)

Found by `src/guide/identify-lesson.test.ts`, the first test to run the
identify lesson's scene through scene → spectrum → detector → tracker →
classifier (with a synthetic voice set, since `speech:` emitters are silent in
Node). Measured over 40 s: the NFM repeater was nameable (true kind among the
candidates) **20%** of the time, and even while talking its top guess was AM,
never NFM. Three causes, fixed at three layers:

- **Classifier.** Full carrier credit saturated at an 18 dB crest, so an FM
  voice station's residual carrier in the pauses (~20 dB measured) scored
  exactly like AM's real carrier (~34 dB measured). NFM also sat at a 12 kHz
  prior with "no carrier" while voice NFM here occupies ~8–9 kHz. Now: a
  `weak` carrier mode (NFM), full credit only at AM strength, NFM centred at
  10 kHz. And CW is a bandwidth call — crest is meaningless for an emission a
  few bins wide — so its prior no longer demands a carrier (requiring one had
  let SSB outscore the lesson's CW station once bandwidth memory widened it).
- **Tracker.** Bandwidth followed every detection at the same rate, so the
  repeater's carrier-only hang collapsed a 9 kHz track to ~750 Hz. Occupied
  bandwidth is now remembered: widens at 0.35/frame, narrows at 0.005/frame.
- **Worker.** A track's guess was recomputed every frame, so a resting
  station's decayed duty and stale width turned it into "CW"/"OOK" in the
  list. The guess is now refreshed only on frames the signal is present.

After: NFM nameable 71% of frames in the raw chain and effectively always in
the app (the cache covers the rests); the lesson's five stations now read
wfm / nfm / am / cw outright with LoRa among its candidates. The measured
feature vectors are regression cases in `classifier.test.ts`; the bandwidth
memory in `detector.test.ts`. The old AM test case had assumed a 16 dB crest.

## Scanner: held on noise from its first channel — FIXED (2026-10-09)

Found by `src/guide/scan-lesson.test.ts`, the first test to run the scan
lesson's own scene through scene → receiver → scanner with a fake clock. On
"Scan the band" the scanner stepped to its first channel (146.5375 MHz, no
station within 137 kHz), declared a hit, held, and never resumed. Cause: until
six idle readings are learned the only threshold is the operator's squelch,
and at the stock −80 dB every empty 12 kHz NFM channel (~−50 dB of noise)
clears it — so the first channel hit, the floor was never learned, and the
hold condition (`level > threshold − 3`) could never fail. This broke the Scan
feature on every band, not just the lesson: step 2 ("stops on a transmission")
passed instantly on nothing and step 3 could never pass.

Fix: the first six channels calibrate the floor and cannot hit (a median
shrugs off a real transmission landing in that window). Now measured on the
lesson's scene with a synthetic voice set installed: holds only on channels
within one step of a station, resumes after the hang time, and a transmission
is heard through during a hold. Mutation-checked: disabling the guard fails
the same three assertions.

## Modes lesson: audio premise measured — PINNED (2026-10-09)

The last lesson whose premise nothing ran through the receiver: the AM tower
"comes through clean" in AM and "goes quiet or distorted" in NFM. Now measured
by `src/test/audioHarness.ts` (`demodAudio` = scene → receiver → 48 kHz audio;
`intelligibility` = peak normalised correlation between the audio's detrended
syllable envelope and the voice lines the station was keying) and pinned by
`src/guide/modes-lesson.test.ts`. Tower in AM 0.945, in NFM 0.561 (USB 0.599,
WFM 0.522); the 118.8 station in NFM 0.940, in AM 0.574.

Two things the measurement taught: a push-to-talk line's on/off step must be
trimmed from the reference and the envelopes detrended, or a mismatched
demodulator's loud-noise → quiet → loud box scores 0.67 just by lining an edge
up with a burst onset; and a mismatched FM discriminator still carries the
speech *rhythm* (its noise output quiets with the sidebands' power), which is
the "distorted" the lesson promises — so the honest floor for "wrong mode" is
~0.5, not 0. Only the tune lesson remains unpinned, and its premise is trivial.

## CW keyer: power-on chatter — RESOLVED (2026-10-09)

Two defects, one of which hid the other.

**The receiver had no BFO.** The CW "Weaver" path mixed down by 650 Hz,
lowpassed, and mixed back up by 650 Hz — net translation zero — so a tuned
CW carrier came out at DC, not at the 650 Hz note the comment claimed.
Decoding only worked because the envelope keyer is pitch-blind. Two
consequences: a centred CW signal was nearly inaudible, and **Split the
Pair was unsolvable** (narrowing 500 → 200 Hz produced byte-identical
audio: the 187-tap FIRs have ~850 Hz transitions and the channel filter
floors at ±300 Hz). Neither the CTF solvability test nor the lesson test
had run the decoy through the DSP. Fixed in `17356eb`: CW now has a real
BFO (`CW_NOTE_HZ`) and a 6th-order Butterworth bandpass as wide as the
filter knob; measured decoy level −15 dB at 500 Hz, −36 dB at 200 Hz;
pinned by `receiver.test.ts`.

**The keyer judged levels with no idea of the floor.** Replaced the
peak-tracking envelope keyer with a narrowband quadrature detector on the
note (~8 dB more margin for weak beacons) plus a 250 ms lookahead
threshold: each 10 ms hop is decided from a 500 ms window's low-percentile
hop mean (floor) and max (ceiling), with a gate that keys nothing when the
ceiling is not clearly above the floor. Measured on identical audio
(`scripts/keyer-bench.ts`, 9 cases):

| case | old keyer | new keyer |
|---|---|---|
| empty channel, 30 s | 1 phantom letter | 0 |
| −26 dB lesson beacon | copies | copies |
| −26 dB CTF beacon | copies | copies |
| squelch opened mid-stream | copies | copies |
| first NCDXF callsign after power-on, 8 starts | **0/8 exact** | **8/8** |
| Split the Pair, stock width, VFO between | garbage | garbage |
| narrowed, VFO between | garbage | quiet |
| narrowed, centred on flag | copies | copies (clean) |

The gameplay survives because the tracker bridges the pair into one
detection, so a tap lands between the carriers: the stock filter hears both,
narrowing silences both, centring copies one. (Tuning straight onto the flag
at the stock width now copies by pitch — what a real operator does.)

Dead ends worth not repeating: a bank of bins using the *minimum* bin as
the noise reference (the tone's own skirt contaminates it, forcing the
multiple so low that noise keys); a window floor from hop *minima* (dense
keying puts a median floor at the tone level; narrowband envelopes fade so
deep a low percentile of minima reads ~0 and the gate never engages) — use
hop *means*; and any variant that skips the first half-window at startup
(it truncates the first element of a transmission that begins at once).

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
- **Below the Gate** — the beacon sits under a squelch a previous operator
  left up. `applySquelchAgc` runs before the worker's `decodeCW`, so a closed
  gate really does starve the decoder while the waterfall still shows the
  carrier. The challenge (and the squelch lesson) declare `startSquelchDb:
  CLOSED_SQUELCH_DB` (−24 dB); the view and the guide store apply it on open.

**Measured 2026-10-09 (`scripts/ctf-solvability.ts`, every CW challenge through
the real receiver):** Below the Gate had shipped *trivially* solvable — the
mirror image of the Split the Pair bug. Its −26 dB beacon peaks at exactly
−26.0 dB of gated channel level (median −52, noise floor −65), 54 dB above the
−80 dB gate every challenge opened at, so the flag copied the moment you tuned
it and the brief's premise was false. The squelch lesson had the same defect:
"the decoder prints nothing" was untrue and its "Lower the squelch" step
completed itself. The earlier keyer-bench cases for these beacons ran with the
gate open or at −60, so they never exercised the premise. Gate sweep: −35 →
57 garbage chars, −30 → fragments leak on key-down, −25 → silent; a clean copy
needs ≲ −40. `src/ctf/gate.test.ts` now pins both premises in the DSP and
checks every other CW challenge opens ≥ 10 dB below its beacon. Also found:
Deep Cut's "loud neighbour" (WFM tone at −60 kHz) does not reach the beacon at
+18 kHz — it copies at the stock 500 Hz filter, so the narrow-filter hint is
advisory and the challenge is a recon/decode exercise, not a filtering one.

The challenge sheet carries a live receiver strip (frequency, mode,
bandwidth, and what the decoder is copying right now) so wrong operating
reads as garbage and correct operating resolves into text as you work.

Done 2026-10-09: **Catch the Rotation** (`catch-the-rotation`, 300 pts) — the
live NCDXF carousel, centred 15 kHz below the beacon so it has to be found;
the flag is the beacon after W6WX, which means copying a callsign across a
slot handoff. `src/ctf/rotation.test.ts` pins that through the receiver and
derives the expected answer from the roster, so a stale hash fails loudly.

**Zero-beat tuning precision — dropped (measured 2026-10-09).** The receiver
does not enforce it: a CW flag copies with the VFO up to ±300 Hz off at the
stock 500 Hz filter (breaks at 400) and ±200 Hz off at 200 Hz (breaks at 250),
with only the first letter garbling near the edge. A challenge that demanded
±50 Hz would be a premise the DSP does not impose — the Deep Cut / Below the
Gate mistake again. Making it real would mean narrowing the keyer's detector
for every CW lesson at once, which is not worth one challenge. The skill the
receiver *does* enforce is the filter, and Split the Pair already tests it.

**Adjacent-channel splatter — dropped (measured 2026-10-09).** SSB voice on
top of a CW flag does not block the copy at any setting tried: a 0 dB USB
voice with its carrier 400 Hz below a −14 dB flag still copies cleanly at the
stock 500 Hz filter, and 1.2 kHz below (flag inside the voice band) copies at
500/300/200. The keyer detects a narrow tone at the beat note and broadband
voice never is one, so the filter has nothing to reject. A "copy through the
splatter" challenge would be unenforced — the same class as zero-beat.

The intercept category's enforceable skills are therefore: the filter (Split
the Pair — a *CW* decoy inside the passband is the only interferer the keyer
cannot ignore), the squelch (Below the Gate), frequency planning (Working the
Input) and timing (Catch the Rotation). New ideas start from a measurement.
