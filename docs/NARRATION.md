# Narration

SPECTRA ships spoken audio for every exam question and every simulated
transmission on the air. Both are rendered ahead of time and served as static
files, so playback needs no network calls and costs nothing per listen.

| What | Renderer | Output |
|---|---|---|
| Exam narration, all three pools | `scripts/kokoro_render.py` | `public/exam/audio/<pool>/` |
| On-air traffic (repeaters, nets, airband…) | `scripts/render_traffic.py` | `public/radio/` |

Both use [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M), an
open-weight neural TTS model (Apache-2.0), through
[kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx). It runs locally on
the CPU, needs no API key, and sounds much better than the system voices it
replaced. The shipped voice is `af_heart`.

## One-time setup

The renderers expect the model in `~/.local/share/kokoro` (override with
`KOKORO_DIR`) and use macOS `afconvert` to encode AAC. `kokoro-onnx` bundles
its own espeak-ng for phonemes, so there's nothing else to install.

```bash
mkdir -p ~/.local/share/kokoro && cd ~/.local/share/kokoro
python3 -m venv venv
./venv/bin/pip install kokoro-onnx soundfile
REL=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
curl -sSLO "$REL/kokoro-v1.0.onnx"
curl -sSLO "$REL/voices-v1.0.bin"
```

## Exam narration

```bash
PY=~/.local/share/kokoro/venv/bin/python
$PY scripts/kokoro_render.py --pool general            # one pool
$PY scripts/kokoro_render.py --pool all                # Technician, General, Extra
$PY scripts/kokoro_render.py --pool general --limit 10 # quick check
```

Each question renders as two clips, the question and then its correct answer:

```
public/exam/audio/<pool>/<ID>.q.m4a
public/exam/audio/<pool>/<ID>.a.m4a
public/exam/audio/<pool>/manifest.json   (version 2)
```

Splitting them is what lets Listen mode pause between question and answer and
reveal the answer in sync. Playback speed (0.85× to 1.75×) is set in the app,
so the clips are rendered once at normal speed.

Rendering is incremental. Each clip is keyed by a hash of its normalised text,
voice, and speed, so a re-run only renders what changed. A partial run with
`--limit` keeps every other entry in the manifest. Add `--force` to re-render
everything, `--voice` to try another Kokoro voice, and `--bitrate` to trade
size against quality (default 32 kbps mono AAC).

### Pronunciation

Question text goes through `normalise()` in `kokoro_render.py` before it's
spoken. Kokoro reads most ham shorthand correctly (MHz, SWR, QSO, CW, SSB, FT8),
so the rules only cover what it gets wrong, found by inspecting its phoneme
output:

- **Units** are expanded: `kHz` → "kilohertz", `4.7 µF` → "microfarads",
  `dBi` → "D B I".
- **Initialisms** it would otherwise read as a word are spelled out: `CTCSS`,
  `PEP`, `NVIS`, `QRP`, `VFO`.
- **Words hams say as words** are respelled: `RTTY` → "ritty", `MOSFET` →
  "moss-fet", `LoTW` → "Log Book of the World".
- **Fractions and ratios** are read naturally: `5/8` → "five eighths",
  `1.5:1` → "1.5 to 1".
- **FCC rule citations** in square brackets are dropped.

If a question sounds wrong, add the term to `SPELL` or `SPELL_OVERRIDES` and
re-run. Only the affected clips render again.

## On-air traffic

The simulator's voice traffic is scripted in `scripts/radio-traffic.json`:
51 transmissions across nine channels, each with a callsign, speaker, and
transcript.

```bash
~/.local/share/kokoro/venv/bin/python scripts/render_traffic.py
```

This writes one clip per transmission, plus `public/radio/index.json` with the
speakers, transcripts, and durations. Comms channels get handheld processing
(band-limited to 300–3000 Hz, then soft-limited, like a transmitter's mic
chain). Broadcast channels stay full-range. The simulator then modulates the
clips through its own FM, AM, and SSB chain, so what you hear in the receiver
has real radio character, not a filter applied on playback.

## Other engines

`scripts/render-narration.mjs` (`npm run narrate`) is the older pipeline. It
renders a single question-plus-choices clip (manifest version 1) with macOS
`say`, Piper, or a cloud API: OpenAI, ElevenLabs, Google, or Azure, each needing
its own API key. The app plays either manifest version, and falls back to the
browser's own speech synthesis for any question without a clip.
