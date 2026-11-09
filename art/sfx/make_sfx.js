'use strict';
// Clear CMOS SFX generator. Original, fully algorithmic audio: no samples.
// Uses the ls-clad build-sfx engine (primitives, seeded noise, WAV writer),
// with the output redirected from Assets/GeneratedSFX to this folder.
// Run: node make_sfx.js   (optional: SFX_ENGINE=<path to build-sfx/tools>)
// Output: mono, 44.1 kHz, 16-bit PCM, peak -6 dBFS, deterministic (seeded).

const path = require('path');
const ENGINE = process.env.SFX_ENGINE ||
  path.join(require('os').homedir(), '.claude/plugins/cache/ls-extensions/ls-clad/1.0.0/skills/build-sfx/tools');
const audio = require(ENGINE);
const { mulberry32 } = audio.humanize;

const SR = 44100;
const TAU = Math.PI * 2;
const PEAK = Math.pow(10, -6 / 20); // 0.50119 = -6 dBFS
const OUT = __dirname;

const N = (ms) => Math.round((ms * SR) / 1000);
const zeros = (len) => new Float32Array(len);
const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const easeInOutCubic = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

// Zero-delay-feedback state variable filter with a per-sample cutoff.
// mode: 'lp' | 'bp' (unity gain at centre) | 'hp'
function svf(x, cutoffAt, q, mode) {
  const out = zeros(x.length);
  const k = 1 / q;
  let ic1 = 0, ic2 = 0;
  for (let i = 0; i < x.length; i++) {
    const fc = Math.min(cutoffAt(i), SR * 0.45);
    const g = Math.tan((Math.PI * fc) / SR);
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x[i] - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    out[i] = mode === 'lp' ? v2 : mode === 'bp' ? k * v1 : x[i] - k * v1 - v2;
  }
  return out;
}
const lp = (x, hz, q = 0.707) => svf(x, () => hz, q, 'lp');
const hp = (x, hz, q = 0.707) => svf(x, () => hz, q, 'hp');
const rms = (x) => { let s = 0; for (const v of x) s += v * v; return Math.sqrt(s / x.length); };
const scaleTo = (x, target) => { const r = rms(x) || 1; const g = target / r; for (let i = 0; i < x.length; i++) x[i] *= g; return x; };
const noise = (seed, len) => audio.pinkNoise(len / SR + 0.01, 1, mulberry32(seed)).subarray(0, len);

// Sum of decaying sine partials. parts: [ratio, gain, tauMs]
function ringNote(len, startMs, f0, parts, attackMs, gain) {
  const out = zeros(len);
  const s0 = N(startMs);
  const aLen = Math.max(1, N(attackMs));
  for (const [ratio, g, tauMs] of parts) {
    const f = f0 * ratio;
    for (let i = s0; i < len; i++) {
      const n = i - s0;
      const env = smooth(n / aLen) * Math.exp(-n / SR / (tauMs / 1000));
      out[i] += gain * g * env * Math.sin((TAU * f * n) / SR);
    }
  }
  return out;
}

// Final stage: exact length, DC fix, edge fades, peak normalise to -6 dBFS.
function finish(name, x, ms, { fadeInMs = 2, fadeOutMs = 10 } = {}) {
  const len = N(ms);
  const y = zeros(len);
  y.set(x.subarray(0, Math.min(len, x.length)));
  audio.removeDC(y);
  const fi = N(fadeInMs), fo = N(fadeOutMs);
  for (let i = 0; i < fi; i++) y[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fi);
  for (let i = 0; i < fo; i++) y[len - 1 - i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / fo);
  y[0] = 0; y[len - 1] = 0;
  // Remove the mean left by the fades with a Hann-shaped correction (zero at both ends).
  let m = 0; for (let i = 0; i < len; i++) m += y[i];
  m /= len;
  for (let i = 0; i < len; i++) y[i] -= 2 * m * (0.5 - 0.5 * Math.cos((TAU * i) / (len - 1)));
  audio.normalizePeak(y, PEAK);
  audio.WavBuilder.write(y, path.join(OUT, name + '.wav'));
}

// 1. warning_tick, 120 ms. Caution: two soft pulses that step down (A6 then G6).
// A rising chirp reads as "go"; a two-pulse rhythm marks the warning family, and the
// small step down says "careful" without sounding like an alarm.
function warningTick() {
  const len = N(120), x = zeros(len);
  const pulses = [[0, 1760, 1.0], [52, 1567.98, 0.8]];
  for (const [startMs, f, g] of pulses) {
    const s0 = N(startMs);
    for (let i = s0; i < len; i++) {
      const t = (i - s0) / SR;
      const env = smooth(t / 0.003) * Math.exp(-t / 0.018);
      x[i] += g * env * (Math.sin(TAU * f * t) + 0.18 * Math.sin(TAU * 2 * f * t) + 0.35 * Math.sin(TAU * 0.5 * f * t));
    }
  }
  finish('warning_tick', hp(lp(x, 6000), 300), 120, { fadeInMs: 1, fadeOutMs: 15 });
}

// 2. refusal_thud, 180 ms. Muted knock that falls: "no", not "punished".
// The old body sat at 85-200 Hz (96% of its energy below 200 Hz), which small
// speakers barely reproduce. The body now falls 260 -> 140 Hz with harmonics, and a
// short inharmonic knock near 430 Hz carries it on laptop and glasses speakers.
function refusalThud() {
  const len = N(180), x = zeros(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = 140 + 120 * Math.exp(-t / 0.035);
    ph += f / SR;
    const env = smooth(t / 0.003) * Math.exp(-t / 0.05);
    x[i] = env * (0.6 * Math.sin(TAU * ph) + 0.6 * Math.sin(TAU * 2 * ph) + 0.3 * Math.sin(TAU * 3 * ph));
  }
  const knock = ringNote(len, 0, 430, [[1, 1, 30], [2.32, 0.5, 15], [4.1, 0.15, 7]], 1.5, 1.1);
  const thump = lp(noise(23, len), 900);
  for (let i = 0; i < len; i++) {
    x[i] += knock[i] + 0.35 * smooth(i / SR / 0.001) * Math.exp(-i / SR / 0.008) * thump[i] * 6;
  }
  finish('refusal_thud', hp(lp(x, 2500), 70), 180, { fadeInMs: 2, fadeOutMs: 25 });
}

// 3. step_confirm, 220 ms. Gentle two-note up-chime: E5 then B5 (a fifth), 70 ms apart.
function stepConfirm() {
  const len = N(220);
  const parts = [[1, 1, 1], [2, 0.14, 0.6], [3, 0.04, 0.4]]; // tau is scaled per note below
  const mk = (tauMs) => parts.map(([r, g, k]) => [r, g, tauMs * k]);
  const a = ringNote(len, 0, 659.26, mk(40), 4, 0.8);
  const b = ringNote(len, 70, 987.77, mk(46), 4, 1.0);
  // Soft mallet on each note onset: presence on small speakers, no click.
  const mallet = svf(noise(31, len), () => 3200, 1.4, 'bp');
  const x = zeros(len);
  for (let i = 0; i < len; i++) {
    const t0 = i / SR, t1 = (i - N(70)) / SR;
    const m0 = smooth(t0 / 0.0003) * Math.exp(-t0 / 0.0025);
    const m1 = t1 > 0 ? smooth(t1 / 0.0003) * Math.exp(-t1 / 0.0025) : 0;
    x[i] = a[i] + b[i] + 0.4 * (m0 + m1) * mallet[i] * 8;
  }
  finish('step_confirm', lp(x, 5000), 220, { fadeInMs: 2, fadeOutMs: 28 });
}

// 4. xray_sweep, 900 ms. Airy band-pass sweep on pink noise, rising 350 -> 5200 Hz.
// Follows the 900 ms ease-in-out-cubic sweep bar. A quiet E5 -> E6 glide keeps it in key.
function xraySweep() {
  const len = N(900);
  const fcAt = (i) => 350 * Math.pow(5200 / 350, easeInOutCubic(i / len));
  const n = noise(37, len);
  const band = svf(n, fcAt, 2.6, 'bp');
  const air = svf(noise(38, len), (i) => fcAt(i) * 1.6, 1.8, 'bp');
  scaleTo(band, 0.2); scaleTo(air, 0.06);
  const x = zeros(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const u = i / len;
    ph += (659.26 * Math.pow(2, easeInOutCubic(u))) / SR; // E5 -> E6, in key with the set
    const env = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.85)), 1.4);
    x[i] = env * (band[i] + air[i] + 0.05 * Math.sin(TAU * ph));
  }
  finish('xray_sweep', lp(x, 6500), 900, { fadeInMs: 6, fadeOutMs: 30 });
}

// 5. ribbon_draw, 1000 ms. Soft shimmer: E-major partials with slow twinkle, a soft E6 pluck at the start.
function ribbonDraw() {
  const len = N(1000), x = zeros(len);
  const rng = mulberry32(51);
  const partials = [
    [659.26, 0.55], [987.77, 0.5], [1318.51, 0.45],
    [1661.22, 0.32], [1975.53, 0.26], [2637.02, 0.14],
  ];
  for (const [f0, g] of partials) {
    const rate = 3.5 + rng() * 5, phi = rng() * TAU, depth = 0.7;
    let ph = rng();
    for (let i = 0; i < len; i++) {
      const u = i / len;
      ph += (f0 * (1 + 0.012 * u)) / SR; // tiny upward drift, follows the draw
      const am = 1 - depth + depth * (0.5 + 0.5 * Math.sin(TAU * rate * (i / SR) + phi));
      x[i] += g * am * Math.sin(TAU * ph);
    }
  }
  const dust = scaleTo(svf(noise(52, len), () => 4200, 0.9, 'bp'), 0.012);
  for (let i = 0; i < len; i++) {
    const u = i / len;
    const rise = smooth(u / 0.25);
    const fall = Math.pow(Math.cos((Math.PI / 2) * smooth((u - 0.6) / 0.4)), 2);
    x[i] = (x[i] * 0.16 + dust[i]) * rise * fall;
  }
  const pluck = ringNote(len, 0, 1318.51, [[1, 1, 60], [2, 0.2, 30]], 3, 0.3);
  for (let i = 0; i < len; i++) x[i] += pluck[i];
  finish('ribbon_draw', lp(x, 4500), 1000, { fadeInMs: 4, fadeOutMs: 20 });
}

// 6. jumper_contact, 90 ms. Tiny metallic tick, a soft seat, then a short E6 "contact made" ring.
function jumperContact() {
  const len = N(90);
  const metal = ringNote(len, 0, 1100, [[1, 1, 22], [2.756, 0.5, 11], [5.404, 0.18, 6]], 0.5, 1.0);
  const seat = ringNote(len, 0, 320, [[1, 1, 8]], 0.5, 0.45);
  const tick = svf(noise(61, len), () => 3500, 1.2, 'bp');
  const made = ringNote(len, 25, 1318.51, [[1, 1, 35], [2, 0.15, 18]], 2, 0.5); // matches the green pad flash
  const x = zeros(len);
  for (let i = 0; i < len; i++) {
    x[i] = metal[i] + seat[i] + made[i] + 0.25 * smooth(i / SR / 0.0004) * Math.exp(-i / SR / 0.0012) * tick[i] * 18;
  }
  finish('jumper_contact', lp(x, 8000), 90, { fadeInMs: 1, fadeOutMs: 12 });
}

// 7. boot_ring, 700 ms. Warm rising resonant swell E3 -> E4, then a soft E-B-E ring.
function bootRing() {
  const len = N(700), src = zeros(len);
  const f0 = 164.81, glideEnd = 0.85;
  let p1 = 0, p2 = 0;
  for (let i = 0; i < len; i++) {
    const g = Math.min(1, i / len / glideEnd);
    const f = f0 * Math.pow(2, smooth(g)); // E3 -> E4
    p1 += f / SR; p2 += (f * 1.0045) / SR; // slow detune beat = warmth
    let s = 0;
    for (let k = 1; k <= 8; k++) s += (Math.sin(TAU * k * p1) + 0.8 * Math.sin(TAU * k * p2)) / Math.pow(k, 1.3);
    src[i] = s;
  }
  const swell = svf(src, (i) => 500 + 2200 * smooth(i / len / 0.8), 2.4, 'lp'); // resonant opening
  const tPk = 0.434; // swell peak (s)
  const x = zeros(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const env = t < tPk ? Math.pow(Math.sin((Math.PI / 2) * (t / tPk)), 2) : Math.exp(-(t - tPk) / 0.085);
    x[i] = 0.11 * env * swell[i];
  }
  const ring = ringNote(len, 400, 329.63, [[1, 1, 110], [1.4983, 0.5, 100], [2, 0.3, 90], [4, 0.1, 70]], 18, 0.55);
  for (let i = 0; i < len; i++) x[i] += ring[i];
  finish('boot_ring', hp(lp(x, 4200), 110), 700, { fadeInMs: 6, fadeOutMs: 14 });
}

warningTick();
refusalThud();
stepConfirm();
xraySweep();
ribbonDraw();
jumperContact();
bootRing();
