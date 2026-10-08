#!/usr/bin/env python3
"""
Render SPECTRA's simulated on-air traffic (scripts/radio-traffic.json) with
Kokoro, one clip per transmission:

  public/radio/<set>/<n>.m4a
  public/radio/index.json     sets, speakers, transcripts, clip durations

  ~/.local/share/kokoro/venv/bin/python scripts/render_traffic.py [--force]

Comms sets get the handheld sound: band-limited to 300-3000 Hz and driven
into a soft limiter, like a transmitter's mic processing. Broadcast sets stay
full range with gentle compression. The simulator then FM/AM/SSB-modulates
these clips through its real DSP chain, so the radio character is earned,
not faked.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts" / "radio-traffic.json"
OUT = ROOT / "public" / "radio"
MODEL_DIR = Path(os.environ.get("KOKORO_DIR", Path.home() / ".local/share/kokoro"))
SR = 24000  # Kokoro's native rate, and the simulator's message rate


def bandpass(x: np.ndarray, lo: float, hi: float, order: int = 4) -> np.ndarray:
    """Zero-phase Butterworth-magnitude band-pass in the frequency domain."""
    n = len(x)
    nfft = 1 << (n + 4096).bit_length()
    X = np.fft.rfft(x, nfft)
    f = np.fft.rfftfreq(nfft, 1 / SR)
    f[0] = 1e-3
    h = 1 / np.sqrt(1 + (lo / f) ** (2 * order))
    if hi:
        h *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    return np.fft.irfft(X * h, nfft)[:n]


def limiter(x: np.ndarray, drive: float) -> np.ndarray:
    peak = np.max(np.abs(x)) or 1.0
    y = np.tanh(drive * x / peak) / np.tanh(drive)
    return 0.92 * y


def process(x: np.ndarray, style: str) -> np.ndarray:
    if style == "comms":
        y = bandpass(x, 300, 3000)
        return limiter(y, 2.4)
    y = bandpass(x, 70, 0)
    return limiter(y, 1.4)


def to_m4a(samples: np.ndarray, out: Path, bitrate: int, sf) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "x.wav"
        # Short silent pads: AAC priming eats the first few ms of audio.
        pad = np.zeros(int(0.04 * SR), dtype=np.float32)
        sf.write(wav, np.concatenate([pad, samples.astype(np.float32), pad]), SR)
        subprocess.run(
            ["afconvert", "-f", "m4af", "-d", "aac", "-b", str(bitrate), "-c", "1", str(wav), str(out)],
            check=True,
            capture_output=True,
        )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    import soundfile as sf
    from kokoro_onnx import Kokoro

    spec = json.loads(SRC.read_text())
    prev_path = OUT / "index.json"
    prev = json.loads(prev_path.read_text()) if prev_path.exists() else {"sets": {}}
    k = Kokoro(str(MODEL_DIR / "kokoro-v1.0.onnx"), str(MODEL_DIR / "voices-v1.0.bin"))

    index = {"version": 1, "rate": SR, "sets": {}}
    total = rendered = 0
    for sid, s in spec["sets"].items():
        style = s.get("style", "comms")
        speed = float(s.get("speed", 1.0))
        bitrate = 24000 if style == "comms" else 32000
        d = OUT / sid
        d.mkdir(parents=True, exist_ok=True)
        lines = []
        for i, ln in enumerate(s["lines"]):
            key = hashlib.sha1(f"{ln['text']}|{ln['voice']}|{speed}|{style}".encode()).hexdigest()[:12]
            out = d / f"{i}.m4a"
            old = (prev["sets"].get(sid, {}).get("lines") or [None] * (i + 1))
            old = old[i] if i < len(old) else None
            if not args.force and old and old.get("hash") == key and out.exists():
                lines.append(old)
                total += 1
                continue
            audio, sr = k.create(ln["text"], voice=ln["voice"], speed=speed, lang="en-us")
            assert sr == SR, sr
            y = process(np.asarray(audio, dtype=np.float64), style)
            to_m4a(y, out, bitrate, sf)
            lines.append(
                {
                    "who": ln["who"],
                    "text": ln["text"],
                    "file": f"/radio/{sid}/{i}.m4a",
                    "dur": round(len(y) / SR, 2),
                    "hash": key,
                }
            )
            total += 1
            rendered += 1
            print(f"[{sid}] {i + 1}/{len(s['lines'])} {ln['who']}: {len(y) / SR:.1f}s", flush=True)
        index["sets"][sid] = {
            "title": s.get("title", sid),
            "style": style,
            "courtesy": bool(s.get("courtesy", False)),
            "continuous": bool(s.get("continuous", False)),
            "lines": lines,
        }
        # Drop clips for lines that no longer exist.
        for f in d.glob("*.m4a"):
            if not f.stem.isdigit() or int(f.stem) >= len(s["lines"]):
                f.unlink()

    prev_path.write_text(json.dumps(index, indent=1))
    size = sum(f.stat().st_size for f in OUT.rglob("*.m4a"))
    print(f"traffic: {total} clips ({rendered} rendered), {size / 1e3:.0f} kB", flush=True)


if __name__ == "__main__":
    sys.exit(main())
