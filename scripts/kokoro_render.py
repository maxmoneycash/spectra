#!/usr/bin/env python3
"""
Render exam narration with Kokoro (open-weight, Apache-2.0) in the
"question, then answer" cram format.

Each question gets two clips, so the app can pause between them, reveal the
answer in sync, and let the listener set the tempo client-side:

  public/exam/audio/<pool>/<ID>.q.m4a   the question
  public/exam/audio/<pool>/<ID>.a.m4a   the correct answer
  public/exam/audio/<pool>/manifest.json   version 2

Runs from the Kokoro venv (see docs/NARRATION.md):

  ~/.local/share/kokoro/venv/bin/python scripts/kokoro_render.py --pool general
  ... --pool all --voice af_heart --limit 20 --force

Incremental: each clip is keyed by a hash of (normalised text, voice, speed),
so re-runs only render what changed. Partial runs (--limit) keep every other
manifest entry.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POOL_FILES = {
    "technician": "technician-2026-2030.json",
    "general": "general-2023-2027.json",
    "extra": "extra-2024-2028.json",
}
MODEL_DIR = Path(os.environ.get("KOKORO_DIR", Path.home() / ".local/share/kokoro"))

# ---------------------------------------------------------------------------
# Pronunciation. Kokoro's phonemiser reads most ham abbreviations correctly
# (MHz, PEP, SWR, QSO, CW, SSB, FCC, FT8); these are the ones it gets wrong,
# found by inspecting its phoneme output. Order matters: longer forms first.
# ---------------------------------------------------------------------------
UNITS = [
    (r"\bGHz\b", "gigahertz"),
    (r"\bkHz\b", "kilohertz"),
    (r"\bMHz\b", "megahertz"),
    (r"\bHz\b", "hertz"),
    (r"(?<=\d)\s*[µμu]F\b", " microfarads"),
    (r"(?<=\d)\s*pF\b", " picofarads"),
    (r"(?<=\d)\s*nF\b", " nanofarads"),
    (r"(?<=\d)\s*[µμu]H\b", " microhenries"),
    (r"(?<=\d)\s*mH\b", " millihenries"),
    (r"(?<=\d)\s*mA\b", " milliamps"),
    (r"(?<=\d)\s*mW\b", " milliwatts"),
    (r"(?<=\d)\s*kW\b", " kilowatts"),
    (r"(?<=\d)\s*kV\b", " kilovolts"),
    (r"(?<=\d)\s*k[ΩΩ]", " kilohms"),
    (r"(?<=\d)\s*M[ΩΩ]", " megohms"),
    (r"[ΩΩ]", " ohms"),
    (r"(?<=\d)\s*VAC\b", " volts A C"),
    (r"(?<=\d)\s*VDC\b", " volts D C"),
    (r"\bdBi\b", "D B I"),
    (r"\bdBd\b", "D B D"),
    (r"\bdBm\b", "D B M"),
    (r"\bdBc\b", "D B C"),
    (r"\bdB\b", "D B"),
]

SPELL = [
    "UHF", "ARRL", "APRS", "SSTV", "CTCSS", "DTMF", "IRLP", "VFO", "AGC", "ALC",
    "DSP", "PSK", "MFSK", "FSK", "AFSK", "SDR", "NCVEC", "VEC", "CSCE", "ULS", "FRN",
    "RACES", "ARES", "EMF", "RMS", "PEP", "SWR", "ITU", "NTIA", "IARU", "SMT", "SMD",
    "LED", "MOSFET", "JFET", "FET", "PNP", "NPN", "BPSK", "QPSK", "OFDM", "NVIS", "MUF",
    "LUF", "TEC", "SFI", "QRP", "QRO", "QRM", "QRN", "QSY", "QTH", "QSL", "QRZ", "QST",
    "LoTW", "IC", "ADC", "DAC", "FFT", "AC", "DC", "RF", "AF", "IF", "BFO", "PLL", "VCO",
]
SPELL += [
    "AM", "EME", "FAA", "AWG", "EIRP", "ERP", "QAM", "ALE", "ARQ", "FIR", "OET", "USPS", "AB",
]
SPELL_OVERRIDES = {
    "RTTY": "ritty",
    "LoTW": "Log Book of the World",
    "MOSFET": "moss-fet",
    "JFET": "J-fet",
    "FET": "fet",
    "SINAD": "sin-add",
    "RADAR": "radar",
    "LASER": "laser",
    "MMICs": "mimics",
    "MMIC": "mimic",
    "VEs": "V E's",
    "VECs": "V E C's",
    "S11": "S one one",
    "S12": "S one two",
    "S21": "S two one",
    "S22": "S two two",
}

FRACTIONS = {
    "1/2": "one half", "1/4": "one quarter", "3/4": "three quarters",
    "5/8": "five eighths", "3/8": "three eighths", "1/8": "one eighth",
    "1/3": "one third", "2/3": "two thirds", "1/10": "one tenth",
}


def spell(word: str) -> str:
    return " ".join(ch for ch in word if ch.isalnum())


def normalise(text: str) -> str:
    t = " ".join(text.split())
    t = re.sub(r"\[[^\]]*\]", "", t)  # FCC rule citations aren't read aloud
    for frac, words in FRACTIONS.items():
        t = re.sub(rf"(?<![\d/]){re.escape(frac)}(?![\d/])", words, t)
    t = re.sub(r"(\d+(?:\.\d+)?)\s*:\s*1\b", r"\1 to 1", t)  # SWR ratios
    for pat, rep in UNITS:
        t = re.sub(pat, rep, t)
    for word, rep in SPELL_OVERRIDES.items():
        t = re.sub(rf"\b{re.escape(word)}\b", rep, t)
    for word in SPELL:
        if word in SPELL_OVERRIDES:
            continue
        t = re.sub(rf"\b{re.escape(word)}\b", spell(word), t)
    t = re.sub(r"\s+([,.;:?!])", r"\1", t)
    return " ".join(t.split()).strip()


def answer_text(answer: str) -> str:
    a = normalise(answer)
    return a if a.endswith((".", "?", "!")) else a + "."


# ---------------------------------------------------------------------------

def sha(*parts: str) -> str:
    return hashlib.sha1("\x1f".join(parts).encode()).hexdigest()[:12]


def to_m4a(wav: Path, out: Path, bitrate: int) -> None:
    subprocess.run(
        ["afconvert", "-f", "m4af", "-d", "aac", "-b", str(bitrate), "-c", "1", str(wav), str(out)],
        check=True, capture_output=True,
    )


def render_pool(k, sf, pool: str, args) -> dict:
    questions = json.loads((ROOT / "vendor/pools" / POOL_FILES[pool]).read_text())
    out_dir = ROOT / "public/exam/audio" / pool
    out_dir.mkdir(parents=True, exist_ok=True)
    mpath = out_dir / "manifest.json"
    prev = json.loads(mpath.read_text()) if mpath.exists() else {}
    prev_items = prev.get("items", {}) if prev.get("version") == 2 else {}

    work = questions[: args.limit] if args.limit else questions
    items = dict(prev_items) if args.limit else {}
    t0 = time.time()
    done = rendered = 0
    with tempfile.TemporaryDirectory() as tmp:
        for q in work:
            qid = q["id"]
            entry = {}
            for part, text in (("q", normalise(q["question"])), ("a", answer_text(q["answers"][q["correct"]]))):
                h = sha(text, args.voice, str(args.speed))
                out = out_dir / f"{qid}.{part}.m4a"
                old = prev_items.get(qid, {}).get(part)
                if not args.force and old and old.get("hash") == h and out.exists():
                    entry[part] = old
                    continue
                samples, sr = k.create(text, voice=args.voice, speed=args.speed, lang="en-us")
                wav = Path(tmp) / f"{qid}.{part}.wav"
                sf.write(wav, samples, sr)
                to_m4a(wav, out, args.bitrate)
                entry[part] = {"hash": h, "bytes": out.stat().st_size, "dur": round(len(samples) / sr, 2)}
                rendered += 1
            items[qid] = entry
            done += 1
            if done % 10 == 0 or done == len(work):
                el = time.time() - t0
                eta = el / done * (len(work) - done)
                print(f"[{pool}] {done}/{len(work)}  rendered {rendered} clips  {el:.0f}s  eta {eta:.0f}s", flush=True)

    manifest = {
        "version": 2,
        "engine": "kokoro",
        "voice": args.voice,
        "speed": args.speed,
        "bitrate": args.bitrate,
        "items": items,
    }
    mpath.write_text(json.dumps(manifest, indent=1))

    # Drop legacy single-clip files (version 1) once this pool is fully on v2.
    if not args.limit:
        for f in out_dir.glob("*.m4a"):
            if f.name.count(".") == 1:
                f.unlink()
    total = sum(p.get("bytes", 0) for e in items.values() for p in e.values())
    print(f"[{pool}] manifest: {len(items)} questions, {total / 1e6:.1f} MB", flush=True)
    return manifest


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pool", default="general", choices=[*POOL_FILES, "all"])
    ap.add_argument("--voice", default="af_heart")
    ap.add_argument("--speed", type=float, default=1.0)
    ap.add_argument("--bitrate", type=int, default=32000)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--print", dest="print_only", metavar="TEXT", help="show normalised text and exit")
    args = ap.parse_args()

    if args.print_only:
        print(normalise(args.print_only))
        return

    import soundfile as sf
    from kokoro_onnx import Kokoro

    k = Kokoro(str(MODEL_DIR / "kokoro-v1.0.onnx"), str(MODEL_DIR / "voices-v1.0.bin"))
    pools = list(POOL_FILES) if args.pool == "all" else [args.pool]
    for p in pools:
        render_pool(k, sf, p, args)


if __name__ == "__main__":
    sys.exit(main())
