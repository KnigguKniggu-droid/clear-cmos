# Clear CMOS SFX

Original synthesized audio: no samples, no licensed clips. Mono, 44.1 kHz, 16-bit, peak -6 dBFS.
- Regenerate: `node make_sfx.js` (needs the ls-clad build-sfx engine; see the top of the script).
- Check: `python -I verify_sfx.py` (needs numpy).

| File | Length | Moment | What it does |
|---|---|---|---|
| warning_tick | 120 ms | Early warning, before a pinch | Two soft pulses stepping down, A6 then G6: "careful" |
| refusal_thud | 180 ms | Refused grab, with the shake | Muted knock that falls: "no", not a punishment |
| step_confirm | 220 ms | Step completed | E5 then B5, 70 ms apart, soft mallet onset |
| xray_sweep | 900 ms | X-ray sweep bar | Airy noise sweep with a quiet E5 to E6 glide |
| ribbon_draw | 1000 ms | Ribbon draws on | E-major shimmer with a soft E6 pluck at the start |
| jumper_contact | 90 ms | Screwdriver touches the pins | Metal tick, then a short E6 "contact made" ring |
| boot_ring | 700 ms | Boot ending | Warm swell, then an E-B-E ring; may tail past the 500 ms visual ring |

## Design rules (v2, 2026-11-08)

Owner decision (William): keep all seven sounds and improve them.

- **Every sound means one thing**, and they share one key (E major), so they read as one family. Microsoft's mixed-reality guidance: users have limited capacity for audio, so each sound should carry specific information ([Spatial sound best practices](https://learn.microsoft.com/th-th/windows/mixed-reality/design/spatial-sound-design)).
- **Rhythm marks the family; pitch direction marks the meaning** ([Glasgow earcon guidelines](https://www.dcs.gla.ac.uk/~stephen/earcon_guidelines.shtml); [Material: applying sound to UI](https://m2.material.io/design/sound/applying-sound-to-ui.html)):
  - Success rises: step_confirm and jumper_contact.
  - Caution uses a different rhythm, two pulses with a small step down: warning_tick. The old version rose in pitch, which reads as "go".
  - The error falls and stays soft, so a normal mistake doesn't sound like a punishment: refusal_thud.
- **Small speakers** (Inferred, standard audio practice): laptop and glasses speakers reproduce little below about 150 to 300 Hz.
  - Measured (Seen, FFT of the WAVs): the old refusal_thud had 96% of its energy below 200 Hz (centroid 109 Hz). Now it has 33% (centroid 310 Hz), carried by a knock near 430 Hz.
  - boot_ring now high-passes at 110 Hz.
- **No harsh highs:** every file is low-passed between 2.5 and 8 kHz. The X-ray whistle that tracked the filter up to about 4 kHz is replaced by an in-key glide.

## Placement in the Lens (recommendations, Inferred)

- **Spatialize sounds that belong to a place** (Microsoft guidance above):
  - warning_tick at the no-go box;
  - refusal_thud at the refused part;
  - jumper_contact at the jumper;
  - boot_ring at the DRAM light.
- **Keep xray_sweep and ribbon_draw unspatialized, or at the board center.**
- **Starting volumes** (relative to 1.0; RMS ranges from -17.9 to -22.3 dBFS):
  - step_confirm 0.7 (frequent);
  - ribbon_draw 0.6 (a bed under speech);
  - warning_tick 0.8;
  - xray_sweep 0.8;
  - refusal_thud, jumper_contact and boot_ring 1.0.
- **Nobody has heard v2 yet** (UNKNOWN). The checks above are measurements, not listening.
