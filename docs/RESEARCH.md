# RF / SDR Landscape Research → Product Thesis

*Compiled 2026-07-18. Star counts verified via the GitHub API on that date; treat as approximate.*

This document does three things:

1. **Reviews the nine browser/Node HackRF projects** that seeded this effort and distills the single most valuable idea in each (§1).
2. **Surveys the broader open-source RF/SDR tool landscape** to locate the gaps (§2).
3. **Synthesizes a product** — [SPECTRA](../README.md) — built directly on those findings (§3).

The one-line conclusion: **every "web SDR" is a browser remote-control for a physical radio, and every hardware-free tool only views static recordings. Nobody synthesizes a live, dense, realistic RF spectrum in the browser and hands you a real receiver to work it. That is the unclaimed product, and it is what we built.**

---

## 1. The nine seed projects (browser / Node HackRF tooling)

### Comparison matrix

| Project | Purpose | Stack | Hardware required? | Standout feature | Stars | Status |
|---|---|---|---|---|---|---|
| **Signal-Weaver** | Browser HackRF RX + multi-mode demod | Vite/React/TS, WebUSB, Web Audio | HackRF One (WebUSB) | Tested pure-TS demodulator library (FM/AM/SSB/CW) | 0 | Active |
| **web_hackrf** | Minimal browser waterfall/FFT frontend | Vanilla TS, WebUSB, Canvas 2D | HackRF **or** RTL-SDR | Swappable device-driver interface + dep-free waterfall | 0 | Active (early) |
| **hackrf-webui** | Local-first SIGINT/monitoring dashboard | Node/TS server + web UI, native libhackrf, SQLite | HackRF (native tools) — simulator optional | Simulator/replay mode + AIS/ADS-B + capture triage | 0 | Active |
| **splatter** | Art/activism site for a LoRa-mesh concept (not an SDR tool) | Next.js 15/TS/Tailwind | None (marketing site) | Y2K landing-page design system only | 0 | One-off |
| **SDRLab** | Browser HackRF RX (WebUSB web app) | React/Vite/TS + **Rust→WASM DSP** | HackRF One (WebUSB) | WASM DSP in Web Worker + AudioWorklet | 2 | Active |
| **MayhemHub** | Web dashboard for HackRF + PortaPack Mayhem firmware | Next.js/TS/Tailwind, **Web Serial**, PWA | HackRF + PortaPack + Mayhem fw | Live screen mirror + remote control + fw flashing | ~251 | Active |
| **hackrf.js** | Node.js library to control HackRF | TypeScript, `usb` (no native module) | HackRF (Node USB) | Native-free libhackrf port; canonical USB protocol ref | ~24 | Maintained |
| **kaedenbrinkman/hackrf** | "Kitchen sink" WebUSB demo app | React (CRA)/TS, WebUSB | HackRF One (WebUSB) | Working TX recipes (garage door, Tesla port) | ~4 | Abandoned |
| **fm-radio** | Server-side FM streaming to browser/VLC | NestJS + Vue 3, `rtl_fm`+`ffmpeg` | Any `rtl_fm`-compatible SDR | `rtl_fm`→`ffmpeg`→RTP pipeline | ~8 | Inactive |

### Most valuable idea to steal from each

- **Signal-Weaver** — a unit-tested, pure-TypeScript demodulator library (FM atan2 discriminator, AM envelope, SSB, de-emphasis, DC-block) with a mockable test harness. *We mirrored this approach — see [`src/dsp/receiver.ts`](../src/dsp/receiver.ts) and its tests.*
- **web_hackrf** — a swappable device-driver interface (one UI, HackRF/RTL-SDR backends) plus a dependency-free `createImageData` Canvas waterfall. *This validates our `SampleSource`-style abstraction and Canvas waterfall.*
- **hackrf-webui** — the `SIMULATOR`/`REPLAY` env-flag pattern: a synthetic radio + deterministic fixtures so the whole UI (and CI) runs with no hardware. **This is the seed of our entire thesis** — but they built it as a *test convenience bolted onto a hardware tool*. We make the synthetic-signal engine the product.
- **splatter** — only the presentation layer (animated tickers, holo/grain CSS). Informs a striking landing aesthetic.
- **SDRLab** — a Rust→WASM DSP pipeline behind a Web Worker + AudioWorklet: the fastest demod path of the set. *We adopt the worker + AudioWorklet architecture (TS today, WASM-ready).*
- **MayhemHub** — the Web Serial console + live screen-mirror/remote-control loop, packaged as an installable PWA.
- **hackrf.js** — a native-free `libhackrf`-over-`usb` port: the canonical reference for the HackRF USB vendor-request protocol, reusable for a **future hardware-ingest path** in SPECTRA.
- **kaedenbrinkman/hackrf** — concrete transmit recipes (Chamberlain Security+, Tesla charge port).
- **fm-radio** — the `rtl_fm | ffmpeg → RTP` child-process pipeline: the simplest "any SDR → network audio" recipe.

### Patterns and gaps shared across all nine

- **TypeScript everywhere**, React/Next dominant, Web Audio near-universal, Canvas 2D (never WebGL) waterfalls, worker+WASM emerging.
- **Two hardware transports:** WebUSB (raw HackRF I/Q — same `libhackrf` vendor requests) and Web Serial (Mayhem firmware console).
- **They all need a $300 radio to do *anything*.** They are control panels, not analysis or learning tools.
- **Receive-first; transmit is an afterthought. HackRF-specific, thin abstraction. Reinvented, lightly-tested DSP** (only Signal-Weaver and SDRLab have real tests). **Chrome/Edge-only.** **Licensing hazard:** MayhemHub, Signal-Weaver, splatter, SDRLab, and kaeden ship with no usable LICENSE — unsafe to fork. A clean-room, permissively-licensed build is itself a differentiator.

---

## 2. Broader open-source RF/SDR landscape

| Category | Representative repos (≈ stars) | Runs in a browser, no hardware? |
|---|---|---|
| **DSP frameworks** | GNU Radio (~6.2k), liquid-dsp (~2.3k), SoapySDR (~1.5k) | No (native; GNU Radio *can* run hardware-free but not in a browser) |
| **Desktop receivers** | SDR++ (~6.1k), SDRangel (~3.9k), GQRX (~3.6k), SigDigger (~2.8k), CubicSDR (~2.3k) | No (native; assume hardware or IQ files) |
| **Web SDR** | OpenWebRX (~1.3k), ShinySDR (~1.1k), PhantomSDR, KiwiSDR (~521), radioreceiver (~192) | **No — every one is a client to a *physical* receiver** |
| **Protocol decoders** | URH (~12.5k), rtl_433 (~7.6k), dump1090/readsb, inspectrum (~2.5k, files-only), multimon-ng, DSD | Mostly native; inspectrum/URH are recordings-only |
| **Signal synthesis / sim** | gps-sdr-sim (~3.5k), gnss-sdr (~2.2k), srsRAN (ZMQ virtual radio), GNU Radio `gr-channels` | Hardware-free but **native, single-system, expert-only, no UI** |
| **Standards / ecosystem** | SigMF (~456), IQEngine (~322, browser SigMF *viewer*), PySDR (~545, textbook) | IQEngine is browser + hardware-free but **static recordings only** |
| **Signal ID reference** | sigidwiki.com, Artemis (~560) | Passive reference material — screenshots + audio clips, zero interactivity |

### The three answers

1. **What runs in a browser with no hardware?** Almost nothing. OpenWebRX / WebSDR / PhantomSDR / KiwiSDR / radioreceiver all require a real radio. The only genuinely hardware-free browser tools are **IQEngine** (views *static* SigMF recordings) and raw JS FFT libraries (primitives, not apps).
2. **Does a browser-native, hardware-free RF *simulator + receiver + trainer* exist?** **No.** The nearest neighbours each miss: IQEngine (static recordings, no live receiver), OpenWebRX (real hardware behind it), gps-sdr-sim→gnss-sdr / srsRAN-ZMQ (true simulation but native, single-system, no UI), SDRangel Test Source (one synthetic tone in a native app), sigidwiki/Artemis (passive content). Commercial analogues (CRFS, Keysight, R&S scenario generators) are closed, expensive, and not browser-native.
3. **The gap:** a browser-native "flight simulator for RF" — a client-side engine that synthesizes a live, dense, realistic multi-emitter spectrum and hands you an authentic SDR receiver (waterfall, VFO, demod audio) plus structured identification/decode training. Every ingredient is proven separately; nobody has combined them.

---

## 3. Synthesis → what we built (SPECTRA)

SPECTRA takes the **proven browser-SDR UX** from the nine seed projects (WebUSB-grade waterfalls, Web-Audio demod, worker+AudioWorklet DSP) and points it at a **synthetic signal source** instead of a radio — closing the exact gap §2 identifies.

| Finding | How SPECTRA answers it |
|---|---|
| Every web SDR needs hardware | 100% software: a physics-based emitter simulator generates the I/Q. Zero install, zero radio. |
| hackrf-webui's simulator is a test aid | We make the **simulator the product** — 12 emitter types, channel model, scenarios. |
| Reinvented, untested DSP | One coherent, **unit-tested** DSP core (FFT vs reference DFT, demod tone-recovery, detector, classifier — 35 tests). |
| SigMF is the interchange standard; IQEngine only *views* recordings | SPECTRA **generates and exports** annotated SigMF captures → they open in IQEngine, inspectrum, GNU Radio. |
| sigidwiki is passive | An **interactive** signal library — inject any of 12 signals into the live band and see/hear it. |
| No training layer anywhere | **Mission scenarios** with objectives, live scoring, and a graded "identify this emitter" quiz. |
| Future hardware | The sample-source seam means a real HackRF (via the `hackrf.js` protocol) can drop in behind the same receiver. |

**Known honest limitation (and roadmap):** the classifier is spectrum-only (bandwidth, duty cycle, spectral crest). It nails analog modes but can confuse spread-spectrum bursts (LoRa vs PSK) because the diagonal-chirp signature is a *temporal* feature the averaged spectrum discards. LoRa still surfaces as a ranked candidate. A spectrogram-domain chirp detector or a small learned classifier is the natural next step — and a compelling one, because SPECTRA can generate infinite perfectly-labeled training data for it.
