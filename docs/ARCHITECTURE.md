# SPECTRA — Architecture

Everything runs client-side. There is no server and no hardware. The signal you see is synthesized, demodulated, analysed, and rendered entirely in the browser.

## Signal flow

```
                         ┌──────────────────── DSP Web Worker ─────────────────────┐
                         │                                                          │
  Scenario ─► Scene ─────┼─► wideband I/Q  ─┬─► SpectrumAnalyzer ─► FFT dB ─────────┼─► main: waterfall + spectrum canvas
  (emitters + noise)     │  @ 1.152 MSPS    │                                        │
                         │                  ├─► Receiver (tune→decimate→filter→      │
                         │                  │   demod→de-emph→AGC→squelch) ─► 48 kHz ─┼─► main ─► AudioWorklet ─► speakers
                         │                  │                                        │
                         │                  └─► EMA spectrum ─► Detector ─► Tracker ──┼─► main ─► detections list + markers
                         │                       │                    │              │
                         │                       └─ noise-floor CFAR   └─ Classifier ─┘
                         └──────────────────────────────────────────────────────────┘
```

- **DSP Web Worker** ([`src/engine/worker.ts`](../src/engine/worker.ts)) runs the whole real-time chain off the UI thread, paced to real time with a self-correcting timer (one 16384-sample block ≈ 14 ms). It transfers spectrum frames and audio blocks to the main thread as `ArrayBuffer`s (zero-copy).
- **Main thread** renders the spectrum/waterfall to Canvas, feeds audio to an `AudioWorklet` ring-buffer player, and drives React for controls and the detections/mission panels. High-rate data (spectrum, audio, meter) bypasses React entirely.
- **Sample rate** is `1,152,000 Hz`, chosen so it divides cleanly to 48 kHz audio (`/24`) and to a 192 kHz WFM IF (`/6`, then `/4`).

## The DSP core (`src/dsp/`), all unit-tested

| Module | What it is | Test check |
|---|---|---|
| `fft.ts` | Radix-2 iterative FFT, precomputed twiddles/bit-reversal | matches a naive DFT; correct bin for a known sinusoid; inverse round-trip |
| `window.ts` | Hann/Hamming/Blackman/Blackman-Harris windows | tapers to zero at edges |
| `fir.ts` | Windowed-sinc lowpass design + streaming complex FIR | unity DC gain, linear phase, stopband rejection |
| `oscillator.ts` | NCO — phasor-recursion complex mixer with drift renormalisation | unit magnitude, correct frequency, additive accumulation |
| `decimator.ts` | Streaming complex decimating FIR (computes only kept samples) | correct output rate; anti-alias rejection |
| `spectrum.ts` | Windowed power spectrum in dBFS, FFT-shifted | full-scale tone reads ≈ 0 dBFS at the right bin |
| `receiver.ts` | Tune → decimate → channel filter → demod → de-emphasis → AGC/squelch | recovers a 1 kHz tone from NFM/WFM/AM; USB vs LSB sideband selection |
| `detector.ts` | CFAR-style energy detector + frame-to-frame tracker | finds seeded emissions; confirms/dedups tracks |

Demodulators: **FM** via a quadrature (atan2) discriminator with 75 µs de-emphasis; **AM** via envelope + DC-block; **SSB** via the **Weaver third method** (down-mix → lowpass I/Q → up-mix → real part), which is what makes USB and LSB genuinely different; **CW** as SSB with a 650 Hz beat oscillator, feeding a live Morse decoder.

## The simulator (`src/sim/`)

Each emitter renders a complex baseband and the NCO up-converts it into the shared wideband buffer; the `Scene` sums all emitters and adds a complex-Gaussian noise floor. A full 12-emitter scene generates **~4–5× faster than real time** in Node (measured in the perf test).

- `emitters.ts` — 12 modulations (WFM/NFM/AM/USB/LSB/CW/2-FSK/OOK/LoRa/PSK/FHSS/radar). Continuous-phase FSK, cyclically-shifted LoRa up-chirps, linear-FM radar pulses, pseudo-random frequency hopping, phasing-method SSB.
- `messages.ts` / `modulation.ts` — procedural message audio (voice-cadence babble, procedural melody, tones) at 24 kHz, linearly interpolated up to the RF rate; a Hilbert transformer for analytic SSB.
- `morse.ts` — text→keying encoder and an adaptive streaming decoder.
- `prng.ts` — a seeded Mulberry32 + Box–Muller RNG so scenarios are **reproducible** (same seed → same spectrum), which matters for grading and tests.
- `signal-kinds.ts` — the taxonomy and metadata (nominal bandwidth, category, recommended demod, waterfall/real-world description) powering the classifier ground truth and the interactive library.

## Detection & identification

The detector runs on an EMA-smoothed spectrum: it estimates the noise floor as a low percentile, thresholds, merges contiguous bins (bridging small gaps), and reports each emission's centroid frequency, occupied bandwidth, SNR, and spectral crest. A tracker gives emissions stable IDs across frames, smooths them, persists bursty signals so they don't flicker out of the catalog, and dedups overlaps. The `classifier` (`src/id/`) scores each signal against per-modulation priors over log-bandwidth, duty cycle, and carrier presence, returning a ranked, confidence-weighted guess.

## App shell (`src/engine/`, `src/store/`, `src/ui/`)

- `engine.ts` — main-thread orchestrator; owns the worker and the Web Audio graph, relays control messages, and fans worker events to listeners. Builds and downloads SigMF on record-stop.
- `store/store.ts` — a small Zustand store for UI/control state and scoring; wires engine events in. Spectrum/audio/meter/chanIQ deliberately skip the store and drive canvases directly.
- `ui/` — `SpectrumWaterfall` (DPR-crisp spectrum + integrated tuner scale with kind-colored detection carets, peak-hold, scrolling waterfall, wheel-zoom centered on cursor, hover freq/dB readout, click/shift-drag to tune/pan) with `WaterfallControls` (colormap + dB levels popover + auto-level), `colormaps`, and the shared canvas palette `theme.ts`; `TopBar` (command bar + transport); `deck/ReceiverDeck` (VFO odometer with click-to-type entry, demod mode chips, custom `Fader` sliders for bandwidth/squelch/volume/noise, `Meter` S-meter with peak hold, `Scopes` IQ constellation + audio waveform); `DetectionsPanel` (Stations) / `SignalLibrary` / `ScenarioPanel` behind `RailTabs` + `PanelSheet` (mobile bottom sheet); `StartOverlay`, `StatusBar`, `SnrHistory` (per-signal uPlot strip). Global keyboard shortcuts live in `hooks/useHotkeys.ts`. UI motion is `framer-motion`; the design system is documented in `DESIGN.md`.
- `academy/` — the RF Academy second view (`store.view`): `LogAxis` (canvas log-frequency explorer, wheel/pinch zoom with LOD label collision-skipping), `Inspector` (band details + scenario handoff), `Lessons` (five rAF canvas concept demos, paused offscreen), and a hand-curated band dataset in `data.ts`. The "Tune the simulator here" action loads a scenario, flips to the console view, and starts the engine.

**Charting choice:** high-rate line charts use **uPlot** (canvas, ~15 KB gz, streams at 60 fps via imperative `setData`, bypassing React). Bundle-heavier SVG chart libraries (e.g. `bklit`) were rejected for the signal-rate hot path. The engine exposes a post-channel-filter **IQ tap** (`Receiver.tapRe/tapIm`) so the constellation scope shows the true tuned-channel signal.

## Recording (`src/recording/sigmf.ts`)

Records wideband I/Q into a growable buffer (capped at 8 s), interleaves it to `cf32_le`, and exports the standard SigMF `.sigmf-meta` (with capture frequency and per-emission annotations from the live detector) + `.sigmf-data` pair — a real, portable artifact.

## Deliberate boundaries

- **Sample-source seam.** The receiver and detector consume a wideband I/Q block from whatever source; today that's the simulator (or a played-back SigMF file). A WebUSB HackRF/RTL-SDR source drops in behind the same seam with no receiver changes.
- **TS-first DSP, WASM-ready.** The hot loops (mixers, FIRs, FFT) are tight typed-array code with comfortable real-time headroom; any one can be swapped for a WASM kernel without touching the surrounding pipeline.
