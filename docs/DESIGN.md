# SPECTRA design: one progression

Status: design, not built. Written 2026-10-09 against the code as of `main`.
Build order and gates are in §9. Every figure here was read from the source files named.

## 0. What this covers

Six changes that turn four peer tabs into one course:

1. Unified progression — one rank, one "next", one log (§1–§2)
2. Station — the home board (§3)
3. Capture import and a forensics mission category (§4)
4. Tradecraft missions (§5)
5. Exam predicted score (§6)
6. Polish and measurement (§7–§8)

Gate for every mission: a bench measurement and a receiver-level test before it ships
(`docs/BACKLOG.md` → "Standing quality bar"). Gate for every UI pass: seen on a phone
through a verified browser. As of this writing no verified browser connects, so every UI
item below is build-and-test only until that changes.

## 1. Current state the design replaces

Views (`src/store/store.ts:17`): `console | academy | exam | ctf`, labelled Receiver /
Train / Tasking / Exam (`src/ui/shell/nav.ts:18`). All four are peers; nothing says what
to do next.

Progress is persisted in four stores that do not read each other:

| Key | Shape | Owner |
|---|---|---|
| `spectra.operator.v1` | `{ since, identified: SignalKind[], missions: string[] }` | `src/store/store.ts:23` |
| `spectra.ctf.v1` | `{ solved: Record<id, {at, points, hintsUsed}>, hints }` | `src/ctf/store.ts:16` |
| `spectra.guide.v1` | `{ completed: string[] }` | `src/guide/store.ts:10` |
| `spectra.exam.v1` | Leitner `Progress { box 0–4, seen, wrong, last }` per question | `src/exam/store.ts:8` |

Two rank functions disagree:

- `src/ui/card/renderOperatorCard.ts:22` `rankFor(signals)` — by count of signals identified
- `src/ctf/store.ts` `rankFor(points)` — by share of 3,650 CTF points (Unlicensed → Operator → Signals Officer)

The Operator Card and the Tasking view can show the same person two different ranks.

Timestamps exist only for flags (`solved[id].at`). Lessons and missions record completion
without a time, so no activity log can be built from them today.

## 2. Unified progression

### 2.1 Derive, don't migrate

Keep the four stores. Add one pure function that reads all of them:

```ts
// src/progression/progression.ts
export interface Progression {
  lessons: { done: string[]; total: 9 };
  flags: { solved: string[]; points: number; totalPoints: number };
  identified: SignalKind[];
  exam: Record<ElementId, { predicted: number; examQuestions: number; passing: number; passedPractice: boolean }>;
  rank: Rank;
  next: NextUp;
}
export function progression(guide, ctf, operator, exam): Progression
```

No store changes except two additive fields so a log can exist:

- `spectra.guide.v1`: add `completedAt: Record<id, number>` (keep `completed[]` for old saves)
- `spectra.operator.v1`: add `missionsAt: Record<id, number>`

Old saves load unchanged; missing timestamps read as `since`.

### 2.2 One rank ladder

| Rank | Requires |
|---|---|
| Unlicensed | nothing |
| Listener | ≥ 1 lesson done |
| Operator | all 9 lessons, **or** ≥ 40 % of flag points |
| Analyst | all 9 lessons **and** ≥ 60 % of flag points |
| Signals Officer | all lessons, 100 % of flag points, and one passed practice exam (any pool) |

Both existing `rankFor` functions become one-line wrappers over `progression().rank` so the
Operator Card and the CTF share text keep their shapes. Tests: pin each threshold; assert
the card and the CTF text report the same rank for the same state.

### 2.3 "Next" resolver

```
nextUp(p):
  first lesson not in p.lessons.done                       → { kind:'lesson', id }
  else first unsolved challenge whose lesson is done       → { kind:'mission', id }
  else first pool with predicted < passing or no pass yet  → { kind:'exam', pool }
  else                                                     → { kind:'clear' }
```

Lesson → challenge links already exist (`Lesson.challengeId`, `src/guide/lessons.ts`); the
seven challenges with no lesson (`morse-beacon`, `fox-hunt`, `chirp-width`, `hopper`,
`sideband`, `deep-cut`, `catch-the-rotation`) are offered after all lessons are done, in
points order.

### 2.4 Activity log

Derived, not stored: merge `solved[].at`, `completedAt`, `missionsAt`, and exam sessions
(`finishedAt`) into one list sorted by time. Entry shapes, in the in-app register:

```
23:52:18Z  TASKING 03 CONFIRMED        narrow the filter
23:58:02Z  FLAG CAPTURED  +300         split the pair
00:14:40Z  EXAM SAT  24/35  GENERAL    below passing (26)
00:20:11Z  EMITTER IDENTIFIED          LoRa (CSS)
```

## 3. Station — the home board

### 3.1 Placement

New view id `station`, first in `NAV`, and the default view on load. Five tabs on the phone
bar (the iOS maximum; at 390 px each tab is 78 px with icon and label). Receiver keeps its
power-on overlay; Station is the landing before it.

Decision for Max (§10): five tabs, or Station replaces the Receiver's power-on screen.

### 3.2 Layout — phone (390 px)

Top to bottom, all on the existing primitives (`GroupLabel`, ruled bars, `StatGrid`,
`BottomSheet`, the tasking panel register from `GuideCoach`):

1. **Header** — `STATION` group label, the UTC station clock (existing), rank chip on the
   right (`OPERATOR`).
2. **NEXT** — one ruled card showing `nextUp`:
   ```
   NEXT
   TASKING 03 · NARROW THE FILTER · 3 MIN
   Two CW beacons 350 Hz apart. The stock 500 Hz filter copies both.
   [ BEGIN ]
   ```
   Tap anywhere starts it (lesson → `useGuide.start`; mission → open its Tasking sheet;
   exam → `startExam(pool)`).
3. **READINESS** — a 3-cell `StatGrid`, each cell tappable to its section:
   ```
   LESSONS      FLAGS          EXAM · GENERAL
   4 / 9        1,150 / 3,650  PREDICTED 24 / 35
   ▰▰▰▰▱▱▱▱▱    ▰▰▰▱▱▱▱▱▱▱     ▰▰▰▰▰▰▰▱▱▱  PASS 26
   ```
   The exam cell shows the pool with the most progress; a new operator sees General
   (the pool the author is studying) until any pool has progress.
4. **LOG** — the last five activity entries (§2.4), monospace, UTC. Footer link `FULL LOG`
   opens a sheet with everything.
5. **OPERATOR CARD** — the existing share button, now reading the unified rank.

Empty state (nothing done): NEXT shows lesson 01; READINESS shows `0 / 9`, `0 / 3,650`,
`PREDICTED 9 / 35` (chance level, §6); LOG shows `NO TRAFFIC LOGGED — BEGIN TASKING 01`.

All-clear state: NEXT becomes `ALL TASKINGS CLEARED` with two actions, `SIT ANOTHER EXAM`
and `LOAD A CAPTURE` (§4).

### 3.3 Layout — desktop (≥ 1024 px)

Two columns in the Train content width: NEXT and LOG left, READINESS and the card right.
Nothing scrolls at 1024 × 768.

### 3.4 Copy

In-app copy stays in the tasking register already used by the coach and the Tasking sheet
(short imperatives, UTC times, `CONFIRMED`/`AWAITING`). No marketing lines. The README and
docs stay plain (`feedback-plain-technical-copy`).

## 4. Capture import and forensics missions

### 4.1 What exists

The engine can already play a file: `playSigMFFile(file, centerFreqHz)`
(`src/engine/engine.ts:269`) parses cf32 and posts `playIQ`; the worker handles `playIQ`
and `stopPlayback` (`src/engine/worker.ts:301,310`). Nothing in the UI calls either.
`src/recording/sigmf.ts` has `parseSigMFData`, `buildSigMFMeta`, `interleave/deinterleave`.

### 4.2 The door

- Receiver top bar: an outline `IconButton` **Load capture** (`FolderOpen`), and drag-and-drop
  onto the stage. On the phone it lives in the panels sheet.
- Accepts a `.sigmf-data` + `.sigmf-meta` pair (meta supplies `core:sample_rate`,
  `core:datatype`, `captures[0].core:frequency`), or a bare `.cf32`/`.cu8`/`.cs16` file,
  which opens a two-field sheet: center frequency and sample rate.
- Datatypes: `cf32_le` (exists), add `cu8` (rtl_sdr output) and `ci16_le` (HackRF, SDR++).
  Each converts to the float pair the worker already takes.

### 4.3 Rate and size

The engine runs at `SAMPLE_RATE = 1,152,000` (`src/engine/protocol.ts:5`). Captures at
other rates are resampled in the worker by a rational resampler for rates in
[250 kHz, 3 MHz]; outside that the sheet refuses and states the rate. Common sources:
RTL-SDR 2.4 MSPS, HackRF 2–20 MSPS (only ≤ 3 accepted), Airspy 2.5/10.

Memory: 20 s of cf32 at 1.152 MSPS is 184 MB as floats. Stream instead: read the `File` in
`BLOCK_SIZE`-sized slices (`16384`), convert and post each block, loop at EOF. Cap 120 s.
Status bar: `PLAYBACK · 00:12 / 00:20 · LOOP`.

### 4.4 What runs on a capture

Everything: waterfall, detector, classifier, chirp analyzer, CW decoder, scanner, signal
card. Ground truth is absent, so the signal card reads `UNATTRIBUTED CAPTURE` and
**Confirm the ID** is disabled (there is no answer key). User-loaded captures never leave
the browser.

### 4.5 Forensics missions — category `forensics`

Missions ship a capture generated by the simulator at build time, so ground truth exists
and the solvability test can run it through the receiver harness:

- `scripts/render-captures.mts` renders each mission's `SceneSpec` with a fixed seed to
  `public/captures/<id>.sigmf-data` + `.sigmf-meta` (cf32, 1.152 MSPS, 15 s ≈ 138 MB raw;
  render at 8-bit `cu8` to ship ≈ 35 MB each, or keep to ≤ 3 missions). Flags hashed as
  today.
- The mission sheet shows `LOAD CAPTURE` instead of a live scene.

| id | pts | Capture | Deliverable |
|---|---|---|---|
| `cold-case` | 200 | 15 s, three emitters (NFM, OOK, CW) | the count of distinct emitters |
| `the-callsign` | 250 | CW callsign + a decoy on the wrong sideband | the callsign |
| `burst-count` | 200 | OOK sensor, 7 bursts in 15 s | the burst count |

Only sim-generated captures ship. No recordings of real traffic.

## 5. Tradecraft missions — category `tradecraft`

Each mission: scene, task, flag, bench, receiver test. Mechanisms reuse what exists:
UTC scheduling (`NcdxfEmitter`, `src/sim/emitters.ts:296`), recorded-traffic scripts
(`public/radio/*`, `EmitterConfig.speech`), the intercept log, and the drone scene's FHSS
emitter.

### 5.1 `scheduled-net` — 300 pts

Scene: 2 m, a net control station on 146.52 MHz that keys up only during UTC minutes
`≡ 2 (mod 5)` for 20 s, reading a check-in roster from a new script `net-sched`.
Brief: a recovered message gives the schedule. Deliverable: the callsign that checks in
second. Mechanism: a `schedule: { periodMin: 5, offsetMin: 2, onSec: 20 }` field on
`EmitterConfig`, driven the same way `ncdxfBand` is.
Bench: silence off-slot (no detections above floor), copy on-slot. Test: harness pins the
clock, asserts the second callsign is in the log.

### 5.2 `pattern-of-life` — 300 pts

Scene: a 70 cm repeater running a new script `net-pol` over four simulated minutes, five
callsigns with check-in counts 3 / 2 / 2 / 1 / 1. Deliverable: the callsign heard most.
Requires using the intercept log, not the ear. Test: harness counts transmissions per
callsign in the log and asserts the top one.

### 5.3 `link-pair` — 350 pts

Scene: the drone band. A PSK telemetry burst every 1.0 s; two FHSS control links. One hops
50 ms before each telemetry burst (`syncTo: 'psk1'`, new `EmitterConfig` field); the other
hops on its own clock. Deliverable: the synchronized link's center frequency.
Bench: cross-correlation of hop times against burst times in the harness, > 0.9 for the
paired link and < 0.2 for the free one. Test: the same correlation on harness output.

Splatter (adjacent-channel interference) stays deferred; see `docs/BACKLOG.md`.

## 6. Exam predicted score

`src/exam/predict.ts`:

```
P(correct | box) : unseen 0.25, box0 seen 0.35, box1 0.55, box2 0.75, box3 0.90, box4 0.97
group P  = mean over the group's questions   (the exam draws one per group at random)
predicted = Σ group P                         (General: 35 groups → /35)
sd        = sqrt(Σ p(1 − p))                  (sum of Bernoulli variances)
range     = [predicted − 1.28·sd, predicted + 1.28·sd] clipped   (≈ 10th–90th)
```

Display: `PREDICTED 24 / 35 · PASS 26 · LIKELY 20 – 28`, in the Station READINESS cell and
the Exam header. `subelementReadiness` (`src/exam/store.ts:462`) stays for the per-topic
view.

Tests: all box 4 → within 1 of `examQuestions`; all unseen → ≈ 0.25 × `examQuestions`;
monotone in box; the author's own progress gives a number that matches a sat practice exam
to within the range (manual check).

## 7. Polish

- **Academy onto the shared recipes** — the audit's remaining items (`docs/BACKLOG.md` §4):
  one spacing scale, card and section patterns from the reels, `ActionButton` for the eleven
  hand-rolled sites. Train rows adopt the Station/Tasking register (`CLEARED FOR …`).
- **Bottom sheet physics** — keep the `BottomSheet` API, replace its internals with Arc UI's
  sheet (MIT; verdict in memory): snap heights, flick-to-close, scroll hand-off. Snaps:
  panels sheet 60 % / 92 %; signal card one line / 60 %; Tasking sheet 92 %.
- **Screenshots and social image** — regenerate with `scripts/qa-shots.mjs` through a
  verified browser; replace the eleven July captures in `docs/screenshots/` and `og.png`.

## 8. Measurement and deploy

- **Counter**: Vercel Web Analytics (`@vercel/analytics`) — cookieless, no identifiers,
  honours Do Not Track, zero config on this host. Events only, no user ids:
  `lesson_done {id}`, `flag {id, hints}`, `exam_finished {pool, score}`,
  `capture_loaded {rate, datatype}`.
- **Deploy**: the GitHub integration stopped firing on 2026-08-19. Reconnect in the Vercel
  dashboard (Project → Settings → Git). Until then: `vercel build && vercel deploy --prebuilt --prod`.

## 9. Build order

| # | Item | Depends on | Tests that must exist |
|---|---|---|---|
| 1 | `progression()` + timestamps + one rank | — | thresholds; card = CTF rank; `nextUp` order |
| 2 | Station view | 1 | render for empty / mid / clear states |
| 3 | `predict.ts` into Station + Exam | 1 | §6 |
| 4 | Capture door + datatypes + resampler + streaming | — | round-trip cf32/cu8/ci16; resampler tone test; 120 s cap |
| 5 | Forensics missions + capture renderer | 4 | each capture through the harness → flag |
| 6 | Tradecraft missions | — | §5 benches and harness tests |
| 7 | Polish | 2 | — (browser gate) |
| 8 | Analytics + deploy reconnect | — | — |

Items 1–3 change what the app is; 4–5 bring in people who own radios; 6 deepens the game.
7 waits on a verified browser.

## 10. Open decisions

1. Five tabs, or Station replaces the Receiver's power-on landing.
2. Capture cap: 120 s streamed, or 20 s in memory (simpler, smaller).
3. Whether Signals Officer requires a passed practice exam.
4. Forensics captures as 8-bit `cu8` (~35 MB each) or fewer missions at cf32.
