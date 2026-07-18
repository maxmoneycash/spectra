# SPECTRA — Expansion Roadmap

> Status board for the four-phase expansion. Research synthesis from five reference repos lives here so the next session can pick up cold.

- [x] **Phase 1 — RF Academy (web, this repo).** Zoomable log-spectrum explorer (100 kHz–10 GHz) with LOD tiers, band inspector, five live concept lessons, and "Tune the simulator here" handoffs into scenarios. Shipped in `src/academy/`.
- [ ] **Phase 2 — macOS menu-bar WiFi console.**
- [ ] **Phase 3 — Hardware bridges (SDR ingest).**
- [ ] **Phase 4 — WiFi sensing lab.**

## Phase 2 — macOS menu-bar WiFi console (next)

New `macos/` Swift project in this repo (Swift 6, SwiftUI, macOS 14+, **MenuBarExtra-first** — replaces the default WiFi switcher). Same design language as the web console (`DESIGN.md`: near-black + ember, IBM Plex).

**Platform reality (researched):** CoreWLAN yields SSID/BSSID/RSSI/channel(band+width)/security IEs at ~3 s cadence. **No true RF spectrum, no noise floor, no monitor mode** — the honest product is a *channel-occupancy console* in our spectrum aesthetic. Location permission required for SSID/BSSID; sign (non-ad-hoc) with the location entitlement from day one.

**To build:**
1. `Scanner` actor — `CWWiFiClient` `scanForNetworks(withSSID: nil)` at 3 s wall-clock-anchored cadence, single-flight coalescing, 3× exponential backoff (wifi-lens + BeaconTrace patterns); connected-AP RSSI at 1 Hz via `interface.rssiValue()` for a smooth trace.
2. Channel-occupancy graph — Gaussian bells (σ = halfWidth/4, −100 dBm baseline) via SwiftUI Canvas+Path; 2.4/5/6 GHz segments; HT40± direction from `CWChannel.description` regex; selection-linked dimming; hover nearest-network. Animate `displayRSSI` toward latest (60 fps), cache derived values (wifi-lens perf lesson).
3. RSSI history — 20-sample ring per BSSID, sparkline + ±2 dB trend arrows, EMA smoothing.
4. Security audit — IE parser (RSN AKM → WPA2/WPA3/OWE, PMF, WPS, HT/VHT/HE/EHT, country) → findings + severity + remediation, modeled on wifi-security-mcp-server's posture schema. **Differentiator: QBSS Load IE (ID 11) channel utilization** — none of the five surveyed macOS analyzers parse it.
5. LAN devices — `arp -a` parse + OUI vendor lookup (wifa pattern).
6. MenuBarExtra — network list + connect/disconnect, mini occupancy strip, "Open Console" window; `.switchToAccessory` on last-window-close (wifi-lens Pro scaffolding pattern); location-permission onboarding + System Settings deep link.
7. Fixture mode with synthetic networks (BeaconTrace pattern) so UI dev needs no hardware.

Reference repos: `SHIINASAMA/wifi-lens` (cadence engine, bell rendering, IE parser, menu-bar scaffolding), `backrunner/WiFiBuddy` (noiseMeasurement==0 → nil), `takuan-osho/BeaconTrace` (single-flight, fixtures), `zheltukheen/wifa` (OUI DB, menu structure), `suzukaze-skrame/wifi-analyzer` (entitlement proof).

## Phase 3 — Hardware bridges (SDR ingest)

WebUSB RTL-SDR behind the existing sample-source seam (`engine/worker.ts` consumes a wideband I/Q block; today it comes from `sim/Scene` or SigMF playback — a third source drops in). Real ham-band surveillance in the web app. Later: HackRF for true 2.4 GHz spectrum feeding the macOS app.

## Phase 4 — WiFi sensing lab

- **RSSI-variance presence experiment** (no extra hardware): high-rate RSSI polling of your own link → spike filter → EMA → windowed variance → motion score (wifiview/WiTrack pattern). Experimental; needs a fixed transceiver pair.
- **ESP32-CSI companion** (Wriple pattern): ESP32-WROOM-32U + esp-csi firmware → UDP CSI stream → subcarrier-amplitude heatmap (our waterfall canvas, ~10 fps) → calibration/noise-gating UX → binary presence model. Reference: `AHG-BSCS/Wriple` (+ `Wriple_ESP32` firmware). Amplitude-only is the documented limitation; phase is where the literature value is.

## Research notes on the security KB

`badchars/wifi-security-mcp-server` is a *knowledge base*, not live attack tooling (no monitor mode anywhere in the plan). Reusable content model: `encryption + capabilities → findings + severity + remediation`, 47 WiFi attack entries with ATT&CK IDs and mitigations — good schema for the Phase 2 security audit and future Academy security lessons.
