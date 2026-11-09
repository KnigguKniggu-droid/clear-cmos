"""Verify the Clear CMOS SFX WAVs. Reads files back with the stdlib wave module.
Run: python -I verify_sfx.py   (numpy required)
"""
import math
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
EXPECTED_MS = {
    "warning_tick": 120, "refusal_thud": 180, "step_confirm": 220, "xray_sweep": 900,
    "ribbon_draw": 1000, "jumper_contact": 90, "boot_ring": 700,
}
MAX_BYTES = 150 * 1024
db = lambda v: 20 * math.log10(v) if v > 0 else float("-inf")

all_ok = True
print(f"{'file':16} {'fmt':14} {'ms':>6} {'KB':>6} {'peak dBFS':>10} {'rms dBFS':>9} "
      f"{'DC %FS':>8} {'first':>5} {'last':>5}  result")
for name, ms in EXPECTED_MS.items():
    p = os.path.join(HERE, name + ".wav")
    with wave.open(p, "rb") as w:
        ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype="<i2").astype(np.float64) / 32768.0
    size = os.path.getsize(p)
    dur_ms = 1000.0 * n / sr
    peak = np.max(np.abs(x))
    dc = float(np.mean(x))
    first, last = int(round(x[0] * 32768)), int(round(x[-1] * 32768))
    checks = {
        "mono16/44.1k": (ch, sw, sr) == (1, 2, 44100),
        "duration": abs(dur_ms - ms) < 0.05,
        "size<150KB": size < MAX_BYTES,
        "peak -6+-0.5": abs(db(peak) + 6.0) <= 0.5,
        "DC<0.05%FS": abs(dc) < 0.0005,
        "edges<=3LSB": abs(first) <= 3 and abs(last) <= 3,
    }
    ok = all(checks.values())
    all_ok &= ok
    bad = [k for k, v in checks.items() if not v]
    print(f"{name:16} {f'{ch}ch/{sw*8}b/{sr}':14} {dur_ms:6.1f} {size/1024:6.1f} {db(peak):10.2f} "
          f"{db(float(np.sqrt(np.mean(x**2)))):9.2f} {dc*100:8.4f} {first:5d} {last:5d}  "
          f"{'PASS' if ok else 'FAIL ' + ','.join(bad)}")
print("ALL PASS" if all_ok else "SOME FAILED")
raise SystemExit(0 if all_ok else 1)
