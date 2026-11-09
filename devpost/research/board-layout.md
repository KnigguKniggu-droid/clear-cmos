# B650 AORUS PRO AX layout, from the manual

> Note: some internal notes named in this document are not included in this public snapshot.

Source: GIGABYTE "B650 AORUS PRO AX User's Manual Rev. 1101", 41 pages. That's the exact ATX board, not the B650M. The PDF is not in the repo.
- p.4: Motherboard Layout drawing.
- p.18: Status LEDs.
- p.25: M.2 slots and heatsinks.
- p.30: CLR_CMOS.
- p.31: RST and BAT.

How positions were measured (William session, 2026-11-08):
- I exported p.4 as vectors and read the exact coordinates of each part outline.
- The board outline is 311.4 x 390.1 pt, a ratio of 1.253; ATX 30.5 x 24.4 cm is 1.250. That gives about 12.78 pt per cm.
- Part sizes in the drawing match real parts within about 2%: CR2032 holder 2.07 cm, PCIe x16 slot 8.75 cm, DIMM slot 14.8 cm.

Labels:
- **MANUAL p.N:** the manual states the fact or shows the part there.
- **ESTIMATE (p.4):** the coordinates are scaled from the p.4 drawing. The manual prints no numbers. Inferred accuracy is about ±0.5 cm.

Method, since the agents disagreed: positions come from the **drawn part shapes** on p.4 (pin squares, battery circle, slot outlines), not from label text positions. Text labels sit beside parts, sometimes on the far side of a leader arrow.

The p.4 render and zooms were sent to William to check by eye, and are not in the repo. William confirmed the RST pins by eye on manual p.4 (see `devpost/design-brief.md`).

## Answers (2026-11-08 17:10 CST)

Frame for these answers: cm from the board's top-left corner with the rear I/O at top-left, the board as printed on p.4. That is portrait: 24.4 cm wide (u, right) by 30.5 cm tall (v, down).

1. **Does RST sit directly beside CLR_CMOS? Yes.**
   - MANUAL p.4: two 2-pin headers in the bottom-right corner, with nothing drawn between them. RST is up and to the right of `CLR_CMOS`, with the RST_SW button right next to RST. `CLR_CMOS` sits directly above the `F_PANEL` header.
   - ESTIMATE (p.4): pin centers about 2.0 cm apart, 1.5 cm across (u) and 1.3 cm up (v).
   - This supports the wrong-pins moment in council.md section 1.
   - council.md's rig numbers (Jumper (1.75, 0.9, 10.8), RstJumper (6.25, 0.9, 10.8)) put them 4.5 cm apart on one line. That doesn't match the drawing: use about 2 cm, offset diagonally (Lens-frame numbers below).
2. **Positions (u, v) in cm:**
   - `CLR_CMOS` (21.5, 29.1).
   - RST (23.0, 27.8); RST_SW (23.6, 27.8).
   - Battery center (12.5, 25.15).
   - Status LEDs block (23.6, 15.4).
   - DIMMs u 18.0-21.3, v 2.6-17.4.
   - PCIEX16 u 4.3-13.0, v 18.1-18.9.
   - M.2 connectors at u 14.2-15.1, at v 15.3-17.4 (M2A), 21.2-23.3 (M2B) and 23.6-25.8 (M2C); the module areas run to u 6.9.
   - All MANUAL p.4 for the part, ESTIMATE (p.4) for the numbers. Full table below.
3. **Does a graphics card cover them?** All Inferred from p.4 positions plus standard PCIe geometry: the card's cooler hangs from the x16 slot toward the bottom edge. Card thickness: UNKNOWN.
   - `CLR_CMOS`: **not covered.** About 10 cm below the x16 slot; a 3-slot card reaches about 6 cm.
   - Battery: **not under the card top-down, but tight.** A 2- to 2.5-slot card stops about 1 cm short; a 3-slot card reaches its edge. The battery also sits beside `M2C_SB`, inside an 80 mm SSD footprint, so an SSD or the M.2 heatsink may cover it. UNKNOWN on the real board.
   - DRAM debug LED: **visible.** The Status LED block is about 2.7 cm above the x16 slot, on the side away from the cooler. It sits at the board's right edge, below the DIMMs' lower end.
   - Which LED in the 2 x 2 block is DRAM: see "W-07: the DRAM status LED" below.

## Frames

The old frame here ("x 0-30.5 right, I/O on the left edge") can't exist. The rear I/O runs along a 30.5 cm long edge, so a landscape view puts it on the top or bottom edge unless the board is mirrored.

- **Manual frame (u, v):** portrait, exactly as printed on p.4, with rear I/O at top-left.
  - u = cm from the rear-I/O edge, 0 to 24.4.
  - v = cm down from the top edge (CPU-power end), 0 to 30.5.
- **Lens frame (x, y):** landscape, for `board.svg` (1024 x 820 px, 33.57 px per cm) and the scene.
  - x = 30.5 - v, y = u. Origin is the top-left of the texture.
  - The rear I/O runs along the top (far) edge, right half.
  - Inferred: this is a tower lying on its right side, window up, seen from the front. The PSU, and so the power cord, end up at the back-left, which matches the scene's cord at x = -45.
  - Rig-local: X = x - 15.25, Z = y - 12.2. +Z is toward the viewer, so the texture top is the far edge.

## Positions

| Part | Manual (u, v) | Lens (x, y) | Rig-local (X, Z) | Label |
|---|---|---|---|---|
| `CLR_CMOS` jumper, 2 pins, center | (21.5, 29.1) | (1.4, 21.5) | (-13.9, 9.3) | MANUAL p.4, p.30; ESTIMATE (p.4) |
| RST jumper, 2 pins, center | (23.0, 27.8) | (2.7, 23.0) | (-12.6, 10.8) | MANUAL p.4, p.31; ESTIMATE (p.4) |
| RST_SW reset button | (23.6, 27.8) | (2.7, 23.6) | (-12.5, 11.4) | MANUAL p.4, p.18; ESTIMATE (p.4) |
| CMOS battery (CR2032) center; holder with a tab at each end | (12.5, 25.15); u 11.4-13.5, v 23.8-26.5 | (5.35, 12.5); x 4.0-6.7, y 11.4-13.5 | (-9.9, 0.3) | MANUAL p.4, p.31; ESTIMATE (p.4) |
| Status LEDs CPU/DRAM/VGA/BOOT, 2 x 2 block | (23.6, 15.4); block 0.4 x 0.6 cm | (15.1, 23.6) | (-0.1, 11.4) | MANUAL p.4, p.18; ESTIMATE (p.4). DRAM LED: see W-07 below |
| DIMM slots DDR5_A1, A2, B1, B2 | u 18.0-21.3 (centers 18.3, 19.2, 20.1, 20.9), v 2.6-17.4 | x 13.1-27.9, y 18.0-21.3 | X -2.2 to 12.7, Z 5.8-9.1 | MANUAL p.4; ESTIMATE (p.4) |
| PCIEX16 slot body (latch extends about 1.3 cm more toward larger u) | u 4.3-13.0, v 18.1-18.9 | x 11.6-12.4, y 4.3-13.0 | X -3.3, Z -7.9 to 0.8 | MANUAL p.4; ESTIMATE (p.4) |
| M2A_CPU connector; 2280 module to standoff | u 14.2-15.1, v 15.3-17.4; module u 6.9-15.1 | x 13.1-15.2; y 6.9-15.1 | X -1.1 | MANUAL p.4, p.25; ESTIMATE (p.4) |
| M2B_CPU connector; 2280 module | v 21.2-23.3; module u 6.9-15.1 | x 7.2-9.3; y 6.9-15.1 | X -7.0 | MANUAL p.4, p.25; ESTIMATE (p.4) |
| M2C_SB connector; 2280 module | v 23.6-25.8; module u 6.9-15.1 | x 4.8-6.9; y 6.9-15.1 | X -9.5 | MANUAL p.4, p.25; ESTIMATE (p.4) |
| CPU socket (center of the four cooler holes) | (12.5, 9.4) | (21.1, 12.5) | (5.9, 0.3) | MANUAL p.4; ESTIMATE (p.4) |

Not in the table: `D_LED1` and `D_LED2` are **addressable LED-strip headers** (MANUAL p.4; p.19 item 8; p.23), not debug LEDs. The debug lights are the Status LEDs above. Don't label anything "D_LED" as a debug light.

## W-07: the DRAM status LED (2026-11-08)

- **Legend order: DRAM is second of four** (MANUAL p.18).
  - The legend box reads row 1 "CPU | DRAM", row 2 "VGA | BOOT", so DRAM is row 1, column 2.
  - The list beside it gives the same order: CPU, DRAM, VGA, BOOT.
- **The p.4 legend matches** (MANUAL p.4).
  - p.4 prints the same legend rotated with the board's silkscreen. Read with that silkscreen upright, it is "VGA | CPU" over "BOOT | DRAM".
  - Turned back to page orientation, it is the same grid as p.18. Seen: both crops rendered at 900 dpi and 600 dpi, and the p.4 crop rotated to compare.
- **Which physical LED is DRAM.**
  - The manual never maps each LED to a name.
  - Seen: the p.4 leader arrow ends on the page bottom-right LED (BOOT under the reading below). Inferred: one leader from a four-name legend box points at the block as a whole, not at one LED.
  - Inferred, if the legend grid mirrors the 2 x 2 LED grid: DRAM is the **top-right LED as printed on the page** (portrait, rear I/O top-left). With the board silkscreen read upright, it is the bottom-right LED.
- **Positions of the four LEDs** (ESTIMATE, scaled from p.4 at 900 dpi, about ±0.3 cm; names Inferred from the legend):

| LED (Inferred) | Manual (u, v) cm | Lens (x, y) cm | Rig-local (X, Z) cm |
|---|---|---|---|
| CPU, page top-left | (23.4, 15.2) | (15.3, 23.4) | (0.0, 11.2) |
| **DRAM, page top-right** | **(23.75, 15.2)** | **(15.3, 23.75)** | **(0.0, 11.55)** |
| VGA, page bottom-left | (23.4, 15.55) | (14.95, 23.4) | (-0.3, 11.2) |
| BOOT, page bottom-right | (23.75, 15.55) | (14.95, 23.75) | (-0.3, 11.55) |

The four LEDs sit within 0.4 cm of each other. At 85 cm a DramLed placed anywhere on the block is within the stated accuracy.

## Coverage

- **`CLR_CMOS` is not covered by a graphics card.**
  - Inferred from p.4 positions: it is about 9.6 cm from the x16 slot along the board, and a 3-slot card covers about 6 cm.
  - Inferred: from the working view (front, 35 degrees down), the card does not block the line of sight.
  - ESTIMATE (p.4): its pins sit directly against the top of the `F_PANEL` header (u 20.3-23.3, v 29.3-30.1; Lens x 0.4-1.2, y 20.3-23.3), with a gap under 0.2 cm in the drawing. It is 1.4 cm from the board's bottom edge.
  - Inferred: in a real case the front-panel cable plugs in right beside it, and a PSU shroud may sit near that edge, so cables can hide it.
  - ESTIMATE (p.4): the two `CLR_CMOS` pins run along y in the Lens frame; the two RST pins run along x. The headers are rotated 90 degrees to each other.
- **The battery is not under the GPU, but it is crowded.**
  - Inferred from p.4: the card's cooler hangs from the x16 slot toward the bottom edge. A 2- to 2.5-slot card stops about 1 cm short of the cell; a 3-slot card reaches its edge.
  - The model of the RX 7900 XT on the real PC, and so its thickness: UNKNOWN.
  - Inferred from p.4: the holder sits beside the M2C_SB connector, inside the footprint of an 80 mm SSD in that slot.
  - MANUAL p.25: the M.2 slots have motherboard heatsinks. Whether a heatsink or SSD sits over the battery on the real board: UNKNOWN; check the board.
  - Reported (TechPowerUp forum, X670 AORUS Elite AX, a different board): Gigabyte has put the battery under a heatsink on related boards.
- **RST sits beside `CLR_CMOS`:** 2.0 cm apart, both 2-pin headers (MANUAL p.4, ESTIMATE distance).
  - MANUAL p.31: RST "can connect to the reset switch on the chassis front panel". It restarts a running PC.
  - Inferred: shorting RST on an unplugged PC does nothing and does not clear the bad setting.
  - The RST_SW button is about 0.6 cm from RST.

## Facts the Lens can quote

- MANUAL p.30: "use a metal object like a screwdriver to touch the two pins for a few seconds."
- MANUAL p.30: "Always turn off your computer and unplug the power cord from the power outlet before clearing the CMOS values."
- MANUAL p.30: after restart, load factory defaults in BIOS Setup ("Load Optimized Defaults").
- MANUAL p.31, battery route: "Gently remove the battery from the battery holder and wait for one minute." Also: "the positive side should face up."
- MANUAL p.18: "If the CPU/DRAM/VGA LED is on, that means the corresponding device is not working normally."
- MANUAL p.16: the back panel has a Q-Flash Plus button. The manual lists no rear Clear CMOS button.
