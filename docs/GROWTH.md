# How people find and try SPECTRA

Updated 2026-10-11. SPECTRA is a browser radio simulator with guided lessons,
radio CTF challenges, and ham exam practice. The useful promise is specific:
someone can practice tuning and signal recognition without buying hardware
or installing radio software. Every signal is simulated.

The immediate work is a clear first session, reliable builds, and links that
take people directly to useful tasks. This plan does not depend on paid
advertising, accounts, a leaderboard, a backend, or recruiting volunteers.

## Match the entry point to the task

These are audience hypotheses, not measured conversion rankings.

| Audience | Task to offer | Why it fits |
|---|---|---|
| Radio newcomer | First contact → Tune and listen | Find a signal, hear a voice, and see what tuning changes. |
| Ham exam learner | A question pool and a receiver lesson | Connect study terms to something observable. |
| SDR hobbyist | A signal-reference page and receiver scene | Explore modulation and receiver behavior without setup. |
| CTF player | First Light, then a harder challenge | Apply the receiver controls to a concrete objective. |
| Instructor or club helper | One guided lesson | A small teaching exercise that opens from a link. |

## Entry links already available

Deep links, the CTF share result, and static signal pages are implemented.
They are no longer feature prerequisites for sharing the app.

| Entry | Link | Intended use |
|---|---|---|
| First session | [Station](https://spectra-one.vercel.app/?view=station) | New users start with the First contact briefing. |
| Introductory challenge | [First Light](https://spectra-one.vercel.app/?c=first-light) | A short independent receiver task. |
| A harder receiver task | [Split the Pair](https://spectra-one.vercel.app/?c=split-the-pair) | Demonstrate why filter bandwidth matters. |
| Exam study | [Technician pool](https://spectra-one.vercel.app/?pool=technician) | Someone already studying can begin in their pool. |
| A focused study topic | [General, G5](https://spectra-one.vercel.app/?pool=general&topic=G5) | Continue a specific learning discussion. |
| A receiver scene | [ISM band](https://spectra-one.vercel.app/?view=console&scenario=ism-sweep) | Explore chirps and other simulated bursts. |
| Radio reference | [LoRa](https://spectra-one.vercel.app/signals/lora/) | Read a signal description before opening the receiver. |

Use `c`, `scenario`, `pool`, and `topic`, as implemented in
[`urlState.ts`](../src/lib/urlState.ts) and
[`useUrlSync.ts`](../src/hooks/useUrlSync.ts). Static reference pages are built
by [`prerender-signals.mts`](../scripts/prerender-signals.mts).
Check the deployed destination before posting; a URL existing in code is not
proof that its latest behavior has reached production.

## What users can share

- The Operator Card renders a callsign-style record and progress image.
- The CTF result shares a text grid, score, and rank without flag answers.
- A specific challenge, study pool/topic, receiver scene, or signal reference
  can be linked directly.

Describe these accurately. The CTF result is a text share, not a new image
renderer. The app has no public leaderboard or cross-device progress account.
Saved progress is local to the browser; it is not a verified qualification.

## Distribution when ready

Prepare one short demonstration that starts at Station, tunes to voice, and
shows the resulting lesson progress. A technical audience may also want the
source and an explanation of scene → I/Q → receiver → audio.

- **Show HN:** lead with something people can try immediately and explain the
  implementation in the first comment. Follow the
  [Show HN guidelines](https://news.ycombinator.com/showhn.html).
- **Radio communities:** choose one forum or club where the topic fits; check
  its current posting rules and disclose that you built the app. Link the
  lesson or reference relevant to the discussion.
- **Classes and clubs:** a lesson can stand alone as a short teaching aid.
  Avoid promising a complete curriculum or replacing hands-on operation.

Draft posts are in [launch.md](launch.md). They have not been submitted by this
work. Community fit and posting rules must be checked at the time of posting.

## Work worth doing next

Keep the first lesson, challenge handoff, audio recovery, and production links
reliable. Use reproducible bug reports and existing tests to decide what to
fix; there is no new analytics or research program in this plan.

If exploration later becomes a priority, test a small simulated expedition as
described in [WATCHDOGS-GO.md](WATCHDOGS-GO.md). Keep live collection and field
analysis within the product boundaries documented there. More content and a
leaderboard can wait until they solve an observed need.
