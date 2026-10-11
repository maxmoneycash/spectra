# v0.1.0 verification

October 11, 2026. SPECTRA remains a static, MIT-licensed browser simulator.

## Automated checks

- Native ARM Node 22.22.1: complete correctness run passed 321 tests in 41 files.
- After the final decoder-freshness and keyboard fixes, the affected campaign
  store and keyboard handler passed all 38 regression tests in two files.
- TypeScript checking and production build passed, including 12 prerendered
  signal pages, their index, sitemap, and robots.txt.
- The existing Vite large-chunk advisory remains; it is not a build failure.
- Wall-clock simulation speed is measured separately with `npm run bench:sim`.
  Correctness CI no longer fails because a shared machine ran a benchmark slowly.

The campaign tests include a real simulation → receiver → Morse decode path,
detector strength comparisons at all three posts, stale-evidence rejection,
wrong-scene/capture handoffs, and persistence validation.

## Browser evidence

The release walkthrough uses the built app in Arc through its verified
Playwriter extension. Screenshots in `docs/screenshots/` are actual app captures.
Phone-sized viewports are desktop browser emulation, not physical-device tests.
Physical iPhone Safari and Android Chrome testing were not performed.

## Repository setup

The repository is public with an MIT license. Its description, homepage, and
nine relevant topics are configured. Contributor setup, issue forms, a pull
request template, and a Node 22 GitHub Actions workflow are included.

Starter issues: [#2](https://github.com/maxmoneycash/spectra/issues/2),
[#3](https://github.com/maxmoneycash/spectra/issues/3), and
[#4](https://github.com/maxmoneycash/spectra/issues/4).

Community launch copy is prepared in [launch.md](launch.md). No community
posts or messages were sent, and no volunteer recruitment is required.
