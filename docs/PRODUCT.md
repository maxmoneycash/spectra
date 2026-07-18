# SPECTRA — Product Brief

> A software-defined radio lab in the browser. Live RF signal simulation, a real DSP receiver, automatic emission detection and identification, SigMF recording, and mission-based training — with **zero hardware**.

## The problem

Learning RF/SDR has two hard gates: **you need a radio** (a HackRF is ~$300; even an RTL-SDR plus antennas is a purchase and a setup), and **you need to install native software** (GNU Radio, SDR++, SDRangel). Both gates lose the curious student, the ham studying for a license, the new SIGINT/EW analyst, and the developer who just wants to prototype a demodulator. And even once you're past the gates, the RF environment you can actually receive is whatever happens to be on the air where you are — you can't summon a LoRa packet, a frequency hopper, or a pulsed radar on demand to study it.

## The insight

Every ingredient to remove both gates already works in a browser (see [RESEARCH.md](./RESEARCH.md)): waterfalls, Web-Audio demodulation, worker-thread DSP, SigMF. They've only ever been pointed at *hardware*. Point them at a **physics-faithful signal simulator** instead and you get a complete, self-contained RF operations environment that runs on a Chromebook.

## What it is

- **A live signal-environment simulator.** 12 emitter types (broadcast/narrowband FM, AM, SSB, CW/Morse, 2-FSK, OOK/ASK, LoRa chirps, PSK bursts, frequency hoppers, pulsed radar) rendered into a wideband I/Q stream with a real noise floor — all generated in real time in the browser.
- **A real software-defined receiver.** Tune anywhere by clicking the spectrum; demodulate WFM/NFM/AM/USB/LSB/CW with live audio; adjustable bandwidth, squelch, and gain. The DSP is genuine (FFT, FIR channelizers, quadrature/Weaver demodulators), not faked.
- **Automatic emission detection + identification.** A CFAR-style detector finds and tracks every signal; a classifier guesses each modulation from its bandwidth, duty cycle, and carrier shape and reports confidence. A live CW/Morse decoder reads beacons.
- **An interactive signal library.** Inject any signal type into the live band to learn what it looks and sounds like — an interactive answer to sigidwiki's static pages.
- **Mission-based training.** Scored scenarios ("find the repeater", "decode the beacon", "catalog the ISM band", "hunt the drone links", "fox hunt") with objectives and a graded identify-this-emitter quiz.
- **SigMF capture.** Record the wideband I/Q and export a standard, annotated SigMF pair that opens in IQEngine, inspectrum, or GNU Radio.

## Who it's for

| Audience | Job it does |
|---|---|
| **Students / hobbyists** | Learn SDR & DSP with no hardware and no install — the on-ramp before (or instead of) buying a radio. |
| **Ham radio operators** | Practice mode recognition, tuning, and CW copy for license exams and contests. |
| **SIGINT / EW trainees** | A safe, repeatable range to practice detection, identification, and cataloging — the defense-adjacent wedge. |
| **DSP developers** | A sandbox to prototype and eyeball demodulators against known-truth signals with instant feedback. |
| **Educators** | Deterministic, shareable scenarios for a classroom — everyone sees the same spectrum. |

## Why it wins

- **Removes the two adoption barriers** every existing tool has: owning hardware and installing native software. The addressable audience is everyone *upstream* of a hardware purchase — far larger than the installed base of radios.
- **A moat that compounds:** scenario content and simulation realism. More missions and more faithful emitters make it more valuable, and none of it can be scraped from a competitor.
- **A natural hardware bridge:** the sample-source abstraction means a real HackRF/RTL-SDR can drop in behind the identical receiver later — SPECTRA becomes the software half of a hardware story rather than being obsoleted by one.
- **A data flywheel:** the simulator produces infinite, perfectly-labeled I/Q — exactly the training set a machine-learning signal classifier needs. The teaching tool and the label factory are the same product.

## Where it goes

1. **Content:** more emitters (ADS-B, POCSAG/FLEX pagers, APRS, DMR/P25 digital voice, GSM/LTE bursts), more missions, a scenario editor and share-by-URL.
2. **Fidelity:** multipath/fading channel models, Doppler, band-plan overlays, true stereo FM (pilot + RDS).
3. **Classification:** a spectrogram-domain chirp detector and a learned classifier trained on the simulator's own labeled output — closing the LoRa/PSK gap.
4. **Hardware ingest:** WebUSB RTL-SDR/HackRF behind the same `SampleSource`, making SPECTRA a real receiver front-end too.
5. **Packaging:** installable PWA; a freemium split (free core + open scenarios; paid mission packs, classroom seats, and org-hosted training ranges).

## Business shape (illustrative)

- **Free:** the simulator, receiver, library, and a starter set of missions — a genuinely useful, self-contained tool that spreads on its own merits.
- **Pro / Classroom:** mission packs, a scenario editor, progress tracking, and multi-seat management.
- **Enterprise / Gov training:** private, hostable training ranges with custom emitter/scenario libraries — the defense-training path, sold as software with no export-controlled hardware attached.
