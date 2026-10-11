# v0.1.0 verification

October 11, 2026. SPECTRA remains a static, MIT-licensed browser simulator.

## Automated checks

[GitHub Actions run 38179268944](https://github.com/maxmoneycash/spectra/actions/runs/38179268944)
passed all **346 tests in 42 files**, type checking, and the production build
on commit `29ae257`. Vercel deployed the same commit to production.

- Campaign coverage includes 35 tests, including three regressions driven by
  the actual Morse decoder's partial-letter revisions and rolling text window.
- The build includes 12 prerendered signal pages, their index, sitemap, and
  robots.txt. The existing Vite large-chunk advisory remains.
- Wall-clock simulation speed is measured separately with `npm run bench:sim`.
  Correctness CI no longer fails because a shared machine ran a benchmark slowly.

The campaign tests include a real simulation → receiver → Morse decode path,
detector strength comparisons at all three posts, stale-evidence rejection,
wrong-scene/capture handoffs, and persistence validation.

## Browser evidence

First contact → guided reception → First Light was exercised in Arc on the
production app. The release's campaign walkthrough reached and saved all
three listening posts. A bug found while checking live identification was
fixed and covered by three real-decoder regressions; the complete post-fix
identifier → debrief browser path still needs a stable automation connection.

The shared Arc Playwriter extension repeatedly disconnected (WebSocket code
1001), interrupting the final walkthrough and recording. The relay remained
running. Automatic native extension activation succeeded without manual
clicks, but it did not resolve the later disconnects. No demo video is attached
or claimed as completed.

README screenshots are actual app captures: the receiver overview from
October 9 and the First contact desktop/phone checks from October 11.
Phone-sized viewports are desktop browser emulation. Physical iPhone Safari
and Android Chrome testing were not performed.

## Repository setup

The repository is public with an MIT license. Its description, homepage, and
nine relevant topics are configured. Contributor setup, issue forms, a pull
request template, and a Node 22 GitHub Actions workflow are included.

Starter issues: [#2](https://github.com/maxmoneycash/spectra/issues/2),
[#3](https://github.com/maxmoneycash/spectra/issues/3), and
[#4](https://github.com/maxmoneycash/spectra/issues/4).

Community launch copy is prepared in [launch.md](launch.md). No community
posts or messages were sent, and no volunteer recruitment is required.
