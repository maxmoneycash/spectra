# Contributing to SPECTRA

SPECTRA teaches radio through a simulated receiver, guided practice, CTF
challenges, and exam study. The browser app works without radio hardware or an
account. Keep that first-use experience intact when proposing a change.

## Start locally

Use Node 22, the version used by CI. Dependencies are locked in
`package-lock.json`; no API keys are needed to run the app.

```sh
npm ci
npm run dev
```

Open the printed localhost URL. Begin at Station for the first lesson, or use
`/?c=first-light` for a challenge and `/?pool=technician` for exam study.

## Pick a change

Bug reports should include a reproducible path, browser/device, expected
behavior, and actual behavior. For a signal problem, include the scenario,
frequency, mode, bandwidth, and squelch where available.

Small fixes, clearer lesson instructions, radio-content corrections, and
reproducible browser reports are useful contributions. Discuss larger features
in an issue before committing to an implementation. Start with the [good first issues](https://github.com/maxmoneycash/spectra/labels/good%20first%20issue).

Useful entry points:

| Area | Location |
|---|---|
| First session and home board | `src/station/` |
| Lessons and coach | `src/guide/` |
| CTF definitions and grading | `src/ctf/` |
| Signal generation and DSP | `src/sim/`, `src/dsp/`, `src/engine/` |
| Exam practice | `src/exam/` |
| Shared progression | `src/progression/` |
| URL state | `src/lib/urlState.ts`, `src/hooks/useUrlSync.ts` |

Use the [README](README.md) for current behavior. Some older product and
architecture documents are historical and say so at their top.

## Validate the result

```sh
npm run typecheck
npm test -- --maxWorkers=2 --minWorkers=1
npm run build
```

CI runs those checks on pushes and pull requests. The build also generates the
static signal-reference pages; there is no deployment step in the workflow.
CI passing does not establish that audio and touch behavior work on a phone.

For DSP, grading, persistence, or navigation behavior changes, add a regression
case that would fail before the fix. Use seeded signals and controlled time
where the outcome depends on a scene or schedule. Preserve the existing
lesson/CTF progression rather than introducing a second score.

For visible changes, walk through the affected task in a browser and report
the viewport, browser, and result. Include both themes or reduced motion when
the change affects them. Clearly label viewport emulation; do not report it as
a physical iPhone or Android check. Follow the workspace's browser automation
policy when using an agent. The older `scripts/qa-*.mjs` files launch browsers
directly and are not the default verification path for configured agents.

### Performance measurements

```sh
npm run bench:sim
```

This optional benchmark reports five scene-generation runs after warming up,
their median, environment, and real-time factor. Run it on an idle machine and
compare like-for-like environments. It measures synthesis in Node, not browser
rendering or audio. Timing is not a correctness assertion in the test suite.

## Send a pull request

Describe the concrete problem, resulting behavior, and checks you actually
ran. Call out remaining limitations. Prefer a focused change over unrelated
cleanup. Cite a source when correcting radio material; avoid putting challenge
answers in screenshots or visible copy.

Generated pool/course files have source conversion scripts listed in the
README. Explain any regenerated content and preserve its credits. Contributions
are distributed under the project's [MIT license](LICENSE); third-party
content notices in [NOTICE](NOTICE) remain in place.
