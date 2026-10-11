# WatchDogsGo assessment

Reviewed 2026-10-11 at commit
[`6412603d6fa7c8f2e6fe76873531d83c61adc63d`][revision]. This was a source review;
the application and its hardware tools were not installed or run.

## Recommendation

Bring its discovery, evidence collection, and expedition ideas into SPECTRA's
simulated radio learning. Keep live field collection in the hardware products.
An eventual field companion can connect their observations without turning
SPECTRA into a device controller or replacing its current receiver.

SPECTRA already has simulated ground truth, a DSP receiver, guided lessons,
CTF challenges, recording playback, and [one progression model][progression].
WatchDogsGo offers useful presentation patterns, but its Python frontend is
not an engine that can be embedded in the existing React application.

## Proposed product boundaries

| Product | Responsibility | Integration boundary |
|---|---|---|
| SPECTRA | Simulated campaigns, radio learning, receiver practice, and exams | Accept recordings and curated scenarios; validate learning against known evidence. |
| LilyShark | Device collection and hardware operation | Produce session observations and captures through its device adapters. |
| Spectrecon | Field attribution and analysis | Correlate observations, record uncertainty, and distinguish evidence from inference. |
| W6CX | Club repeaters and club operating context | Supply relevant repeater references or learning links; keep club operations separate. |

These are recommended responsibilities, not claims that cross-product
integrations already exist. Start with an explicit file or session boundary;
there is no need to reorganize the repositories first.

## What WatchDogsGo implements

- A Linux-oriented Python/Pyxel application, fixed at 640 by 360 pixels and
  30 FPS. Its 7,856-line [main module][app] owns much of the interface,
  hardware coordination, game state, and input handling.
- A discovery loop: scan, display observations on a map, retain session files,
  and award ranks and badges. [Persistence][loot] includes XP, known devices,
  and MeshCore contacts with notes.
- ESP32 serial and GPS integration, plus [RTL-SDR subprocess adapters][sdr]
  for ADS-B and 433 MHz sensor decoding. These depend on native tools and
  hardware; they are not browser implementations.
- [MeshCore integration][mesh] with channels, contacts, messages, and background
  notifications. LoRa support connects directly to an SX1262 over SPI.
- [Python plugins][plugins] with menu, update, and drawing hooks and direct
  application access. This is an in-process extension interface, not a portable
  service boundary. The repository includes import and community-sync plugins.
- A [community API client][sync] for session uploads, identity, and badges.
  The community server is not included in this checkout.

## Implementation caveats

- The SPACE ["hack" interaction][hack] marks a discovered item as hacked and
  awards XP after a timed hold. Separate menu operations invoke real tools.
  The game interaction itself does not demonstrate a successful exploit.
- Live Wi-Fi and BLE [map markers][markers] receive random offsets around the
  receiver's GPS position. They are not measured transmitter locations.
  [Saved observations][observations] use the receiver's position and retain
  stronger-RSSI sightings; that is not triangulation either.
- BlueDucky, RACE, BLE HID, and HID Type are marked WIP in the [actual menu][wip],
  despite broader capability descriptions in the README.
- Detailed map downloads [require a Stadia Maps key][maps]. Cached tiles can
  be used offline; the bundled coastlines do not require that download.
- No-ESP32 startup permits UI exploration. It does not provide a simulated RF
  environment or mission engine. Offline operation means local collection
  and cached data, not SPECTRA's hardware-free simulation.
- [Contributor notes][contributing] acknowledge the large main module and
  lack of tests. Some documentation is stale, so implementation takes priority.

## Scoped roadmap

1. **Implemented — First contact:** a Station briefing that leads into the existing
   **Tune and listen** lesson, then **First Light**. Reuse current lesson,
   challenge, and progression state. New, lesson-complete, and
   challenge-complete states were checked in Arc, including real receiver
   operation and flag submission. The phone coach sits above the receiver;
   the first lesson keeps tuning visible and expands other controls on demand.
2. **Implemented — Fox trail:** one fictional mapped fox hunt. Three listening
   posts change the simulated beacon power. The journal requires live detector
   observations and a freshly decoded Morse identifier before the player can
   choose a site and read the debrief. Progress persists locally; there is no
   hardware/GPS access and no additional XP economy.
3. **Later, if needed:** define a versioned observation/session import with
   source, time, receiver position, signal metadata, and evidence references.
   Distinguish simulated, imported, and live evidence. Keep hardware access
   in companion adapters and keep imported findings out of automatic CTF grading.

Preserve the existing rank system. Reward verified learning rather than
adding a second XP economy for repeated scans. Start without live hardware,
accounts, community uploads, or a shared backend.

## License and reuse

The reviewed root [LICENSE][license] contains the MIT text, copyright
2025–2026 LOCOSP, and an additional notice about responsibility for use of
security tooling. Its permission condition requires retaining the copyright
and permission notice in copies or substantial portions of the software.
SPECTRA's own [LICENSE](../LICENSE) is MIT, copyright 2026 SPECTRA contributors.

The bundled [Spleen font][font] separately identifies BSD-2-Clause licensing.
Map services and other external assets need their own attribution and terms
checked before reuse. This proposal uses original SPECTRA implementation and
branding; it does not depend on copying WatchDogsGo code or artwork.

[revision]: https://github.com/LOCOSP/WatchDogsGo/tree/6412603d6fa7c8f2e6fe76873531d83c61adc63d
[progression]: ../src/progression/progression.ts
[app]: https://github.com/LOCOSP/WatchDogsGo/blob/6412603d6fa7c8f2e6fe76873531d83c61adc63d/watchdogs/app.py#L47-L214
[loot]: https://github.com/LOCOSP/WatchDogsGo/blob/6412603d6fa7c8f2e6fe76873531d83c61adc63d/watchdogs/loot_manager.py#L440-L535
[sdr]: https://github.com/LOCOSP/WatchDogsGo/blob/6412603d6fa7c8f2e6fe76873531d83c61adc63d/watchdogs/sdr_manager.py#L1-L120
[mesh]: https://github.com/LOCOSP/WatchDogsGo/blob/6412603d6fa7c8f2e6fe76873531d83c61adc63d/watchdogs/lora_manager.py#L1-L107
[plugins]: https://github.com/LOCOSP/WatchDogsGo/blob/6412603d6fa7c8f2e6fe76873531d83c61adc63d/plugins/plugin_base.py#L14-L69
[sync]: https://github.com/LOCOSP/WatchDogsGo/blob/6412603d6fa7c8f2e6fe76873531d83c61adc63d/plugins/wardrive_upload.py
[hack]: https://github.com/LOCOSP/WatchDogsGo/blob/6412603d6fa7c8f2e6fe76873531d83c61adc63d/watchdogs/app.py#L3850-L3884
[markers]: https://github.com/LOCOSP/WatchDogsGo/blob/6412603d6fa7c8f2e6fe76873531d83c61adc63d/watchdogs/app.py#L3341-L3419
[observations]: https://github.com/LOCOSP/WatchDogsGo/blob/6412603d6fa7c8f2e6fe76873531d83c61adc63d/watchdogs/loot_manager.py#L887-L963
[wip]: https://github.com/LOCOSP/WatchDogsGo/blob/6412603d6fa7c8f2e6fe76873531d83c61adc63d/watchdogs/app.py#L182-L188
[maps]: https://github.com/LOCOSP/WatchDogsGo/blob/6412603d6fa7c8f2e6fe76873531d83c61adc63d/watchdogs/app.py#L2214-L2226
[contributing]: https://github.com/LOCOSP/WatchDogsGo/blob/6412603d6fa7c8f2e6fe76873531d83c61adc63d/CONTRIBUTING.md#L126-L136
[license]: https://github.com/LOCOSP/WatchDogsGo/blob/6412603d6fa7c8f2e6fe76873531d83c61adc63d/LICENSE
[font]: https://github.com/LOCOSP/WatchDogsGo/blob/6412603d6fa7c8f2e6fe76873531d83c61adc63d/assets/spleen-5x8.bdf#L1-L13
