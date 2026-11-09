# Build log

> Note: some internal notes named in this document are not included in this public snapshot.

Real results from the CLAD loop. Scores are the reviewer agent's estimates, not judge scores.

| Round | Design | Technical | Innovation | Presentation | Fix delivered | Commit |
|---|---|---|---|---|---|---|
| Setup | n/a | n/a | n/a | n/a | Leaf 2.0.2 installed to match SIK; 6 LEAF scenarios written | ab14cda |
| 1 | 4 | 5 | 3 | 3 | Red no-go boxes, proximity strengthening, 0.3 s refusal shake and flash | ba94d94, 905f8e6 |
| 2 | 5 | 6 | 5 | 4 | Safe-path ribbon; Memory box receives real cursor clicks | 6f01efc |
| 3 | 5.5 | 7 | 6 | 4.5 | In progress: refusal line placed beside the refused part | pending |

Scores in each row are the review taken before that round's fix.

## What the tests prove
All 6 LEAF scenarios passed after round 2, using real SIK interactors.
These tests are weaker than the brief in two places: s3-order still requires the GPU before the fix, and s5a has no check for the first-boot message. Both are known and queued.

## Real defects the loop found
- Round 2: the StepLabel panel collider blocked the cursor ray to the memory. Fixed.
- Round 2 review: a click on the red Memory box refused the Glass with a generic line. Fixed.
- Round 3 review: refusal text is not visible at the 35 degree working view. In progress.

## Queue, in reviewer order
Refusal line placement; first-boot hold before boot; jumper directly after glass; screwdriver animation; symptom wait gate; X-ray more clearly buried at the working view; scene label.

## Sprint E: stabilize
Results are LEAF scenarios run one at a time in the Lens Studio Preview, read from the DefaultLeafScenarioManager log lines. Commit under test: c74bf4c.

| Run | State | Passed | Failed | Detail |
|---|---|---|---|---|
| 1 | Before the wait card note change | 7 | 1 | s5a-jumper failed: `WaitCard note says "real wait: a few minutes"` |
| 2 | Note set to "Time-lapsed." in the scene (c74bf4c) | 8 | 0 | s1-start, s2-anchor, s3-order, s4-refusal, s5a-jumper, s5b-battery, s6-band, s7-early-warning |
| 3 | After the mutation check, code restored to c74bf4c | 8 | 0 | The same 8 scenarios |

Mutation check, to prove that two new assertions can fail. Each mutation was removed after its run.
- `p.clearHover()` removed from `setStep`: s3-order failed with `Glass outline was still on in the first frame of the next step`.
- The repeat-value check removed from `setRemaining`: s5a-jumper failed with `countdown text was written 92 times in a 2 s wait`.

s3-order did not hang in this session. The one test step that could wait forever was the re-grab wait in `regrabDuringReturn`, used by s5b-battery. It now stops after 300 frames and fails with a message.

## Sprint F: the real board and the wrong pins
Results are LEAF scenarios run one at a time in the Lens Studio Preview, read from the DefaultLeafScenarioManager log lines. Commit under test: b415d92.

| Run | State | Passed | Failed | Detail |
|---|---|---|---|---|
| 1 | Sprint F scene and scripts | 9 | 0 | s1-start, s2-anchor, s3-order, s4-refusal, s5a-jumper, s5b-battery, s6-band, s7-early-warning, s8-rst |

Mutation check, to prove that s8-rst can fail. The mutation was removed after its run, and s8-rst passed again.
- Pinching `RstJumper` at `Step.Fix` finished the fix: s8-rst failed with `RstJumper shake peaked at 0.000 cm`.

Changes: `Jumper`, `XRayJumper`, `Battery`, `XRayBattery`, `GPU`, and the callout moved to the panel-1 fix 2 positions. `RstJumper` added: two pin pairs 1.98 cm apart, pinch targets 5.95 cm apart in the 3x callout. `RIBBON_BENDS` and `BatteryPad` moved. `PowerButton` moved to z 15.6 so its collider does not overlap the CLR_CMOS target. `CmosBoard.mat` uses `art/textures/board.svg` at 1024 x 820. The `CLR_CMOS` and `Battery` labels stay hidden until the scan.

Working view measured: Preview camera at (0, 0, 0), rotation x 324.98 degrees, with `Rig` 85 cm from the eye. The panel capture is portrait, 618 x 1100; the 16:9 frame check is not done.

## Sprint G: reveal, strings, and finish
Results are LEAF scenarios run one at a time in the Lens Studio Preview, read from the DefaultLeafScenarioManager log lines. Commit under test: 43c867a.

| Run | State | Passed | Failed |
|---|---|---|---|
| 1 | Sprint G final code | 9 | 0 |

Three new assertions were mutation-checked and failed as intended. Changes: panel strings, shell fill, full-brightness edges, bold amber marks, chassis outline, bright table edge, arrow with a shaft, 2 s screwdriver hold, and panels above the glass.

Not done: the 16:9 frame check (the landscape capture failed with "The operation timed out."), the manual pass, and the real-mouse hover on both pin pairs. The front-left corner is still crowded and the board art is faint at the working view. The LEAF overlay text appears in captures until LEAF is disabled for recording.

## Sprint H: sound and proof
Results are LEAF scenarios run one at a time in the Lens Studio Preview, read from the DefaultLeafScenarioManager log lines. Commit under test: 813da5e.

| Run | State | Passed | Failed | Detail |
|---|---|---|---|---|
| 1 | Sprint H code; Assets are identical to 813da5e | 10 | 0 | s1-start, s2-anchor, s3-order, s4-refusal, s5a-jumper, s5b-battery, s6-band, s7-early-warning, s8-rst, s9-sound |

Sound (art/sfx/README.md), from the s9-sound log, one line per play, each with `playing=true`: `step_confirm` (Symptom), `ribbon_draw` and `xray_sweep` (scan), `warning_tick` (rest on MemoryStick), `refusal_thud` (refused Glass), `step_confirm` (PowerCord), `step_confirm` (Glass), `jumper_contact` (0.318 s after the pinch, at the touch), `refusal_thud` (refused PowerButton), `step_confirm` (Rebuild), `step_confirm` (Power on), `boot_ring` (Done). This proves the moments by log. Nobody has listened to the sounds.

Mutation check, to prove that the new assertions can fail. Four `playSfx` calls were removed in one temporary build and restored after the runs.
- `warning_tick`: s7-early-warning failed with `expected one warning_tick, count is 0`, and s9-sound failed with `sounds played were [step_confirm,ribbon_draw,xray_sweep], expected [step_confirm,ribbon_draw,xray_sweep,warning_tick]`.
- `refusal_thud`: s4-refusal failed with `the refused pinch played refusal_thud 0 times`.
- `boot_ring`: s5a-jumper failed with `boot_ring played 0 times at the boot ending`.
- battery-drop `step_confirm`: s5b-battery failed with `the battery drop played step_confirm 0 times`.

Recording mode: the `recordingMode` input on `ClearCmosMain` disables `LeafIndex` and `LEAF Plugin Bridge` at Lens start. With it on, the log printed both `recordingMode: disabled` lines, a LEAF run of s1-start returned `The operation timed out.` with no `RUNS:` line in the log, and the panel still listed the 10 scenarios. With it off, s1-start passed again. Do not save the scene while it is on.

Tool side effect: `QueryRuntimeSceneTool` installed `Packages/AiPreviewAgentInspect.lspkg`, added a root object `AiPreviewAgent Handler`, and broke compilation with TS2307 in that package. It was removed the same session (object deleted, package removed with `assetManager.remove`, compile clean). Do not call that tool, `CaptureRuntimeViewTool`, or `PreviewInteractTool` in this project.

Changes: the seven WAVs are imported to `Assets/GeneratedSFX` and played from `ClearCmosMain.playSfx` at the README volumes; new scenario `s9-sound`; sound assertions in s4, s5a, s5b, and s7; s5a checks the first-boot hold after 300 ms. The out-of-view arrow keeps its trigger but has no sound: the old chime is removed and the README names no sound for that moment. `Buzz.wav` and `Chime.wav` stay on disk, unreferenced.

Not done: a person listening to the sounds; spatial placement (README recommends it, Inferred); the 16:9 frame check; the manual pass (`design-brief.md` done criterion 6); real-mouse hover on both pin pairs.

## Fix round 1: wrong reach, frames, input hazards
Results are LEAF scenarios run one at a time in the Lens Studio Preview, read from the DefaultLeafScenarioManager log lines. Tested tree: this commit, on top of dd2cf6c. Input was the LEAF scripted interactor, not a person. Capture: `ClearCMOS-media/screens/round-1.png`.

| Run | State | Passed | Failed | Detail |
|---|---|---|---|---|
| 1 | Final code of this round | 10 | 0 | s1-start, s2-anchor, s3-order, s4-refusal, s5a-jumper, s5b-battery, s6-band, s7-early-warning, s8-rst, s9-sound |

Mutation check, to prove that the new assertions can fail. Each mutation was removed after its run.
- `setNoGoCurrent` call removed from `setStep`: s8-rst failed with `RstJumper rests at no-go alpha 0.140, expected at least 0.45`.
- Callout half sizes set back to 0.8 and 0.5: s8-rst failed with `the amber callout boxes have a gap of only x -0.21, z 0.39 cm`.
- `!this.glass.isMoving` removed from the GPU pinch: s3-order failed with `ring on Battery is true, expected rings: Jumper`.
- `!heldSinceLift` removed from the dwell: s7-early-warning failed with `a held cursor over Socket warned after the card lifted, count rose by 1`.

Changes, observed on screen at 85 cm:
- Wrong reach: the two amber boxes no longer touch (measured gap x 0.84 cm, z 1.44 cm). Both pinch targets moved 1 cm in +x, off the real-size cage, and they keep the 3x offset. The green Jumper ring draws above the amber and sits on the callout plane. RstJumper rests at no-go alpha 0.5, as thin red lines around the box. One CLR_CMOS label and one RST label show. A black patch `SilkscreenMask` hides the board-art `CLR_CMOS` while the callout is on.
- Frames: `Glass` y 8, `Monitor` y 19, the Glass ring on the near glass area above the fans (px y about 415 to 468), `AnchorButton` and `RebuildButton` at the lane position, `RefusalLine` 27 x 5.5. The Done text is two lines with no orphan. `MonitorScreen` boot text is shortened to "Booting...", so no clipped word shows at the working view. `Or lift graphics card` replaces `Or lift GPU`.
- Input: a GPU pinch is ignored while the Glass is lifting. A held ray does not start a warning dwell after a Glass or GPU lift, until the ray moves about 0.5 degrees.

Values changed from the render audit: `SymptomLabel` text size is 55, not 68. At 68 s1-start failed because the panel still holds both sentences: the text box measured half height 3.87 cm against a 2.75 cm panel. Size 68 assumes Fix 4 (a separate note panel), which is not in this round.

Limits and open items:
- `TRAINING_LABEL` has no line break now, but it is too long for one visual line and wraps to two lines in the panel.
- The `Monitor` bottom edge still shows as a faint dashed line near row 290, above the card. Fix 3 predicted it would not show.
- The double-press guard covers only the 0.6 s Glass lift. The second press that lifted the card in the earlier pass came 0.93 s after the first, so a press that late still lifts the card.
- Static trace, not run: the dwell uses a slab test that ignores cover, so a cursor resting on the GPU with a ray through the Socket can warn before any lift.
- Not done: the manual pass, the 16:9 frame check, listening to the sounds, the fast-sweep false-trigger check from U1, the real-cursor repeat of the two hazards, U2 captures, render-audit Fixes 1, 2, 4, 6, and 7.

## Round 2 visual fixes (commits 4bb4faa, f77403c, 9f86a4f), 2026-11-08

Tested tree: the tree of commit 9f86a4f, on top of 9d00716. Results are LEAF scenarios run one at a time in the Lens Studio Preview, read from the DefaultLeafScenarioManager log lines. Input was the LEAF scripted interactor, not a person. Capture: `ClearCMOS-media/screens/round-2.png` (s6-band stopAt Fix, maxDimension 1100; the LEAF overlay text is on it).

| Run | State | Passed | Failed | Detail |
|---|---|---|---|---|
| 1 | Final code of this round | 10 | 0 | s1-start, s2-anchor, s3-order, s4-refusal, s5a-jumper, s5b-battery, s6-band, s7-early-warning, s8-rst, s9-sound |

Mutation checks, to prove that the new assertions can fail. Each mutation was removed after its run, and the run above used the restored code.
- RST callout color set to `XRAY_COLOR`: s8-rst failed with `the RST callout color {x: 1, y: 0.757, z: 0.302} is too close to the Jumper callout color {x: 1, y: 0.757, z: 0.302}`.
- `playWarningFlash(0.3)` in place of the 600 ms hold: s7-early-warning failed with `MemoryStick filled box held for only 0.272 s, expected at least 0.55` (the threshold was later set to 0.5).
- `symptomNote.show(symptomLabelLine1, 0)`: s1-start failed with `SymptomNote says "BIOS change, then DRAM light and no signal for several minutes? Pinch the light."`.
- `SCREWDRIVER_TRAVEL_CM` 1: s5a-jumper failed with `Screwdriver moved only 0.67 cm`.
- Screwdriver handle center y 3: s5a-jumper failed with `Screwdriver is only 10.75 cm long`.
- `WAIT_CARD_UP_CM` 12.9: s6-band failed with `WaitCard overlaps XRayPierce at the working view: panel y 0.081 to 0.222, part y -0.011 to 0.083, panel x -0.188 to 0.071, part x -0.141 to 0.000`.

Changes, observed on screen at 85 cm unless a row says otherwise:
- Fix 1. The RST callout (`XRayCalloutRst`, a new object beside `XRayCallout`) and its `NoGoBox` draw in Danger red with thicker bars. Amber and the green ring stay on CLR_CMOS only. The early warning adds a filled red `NoGoFlash` box under each decoy, held for the 600 ms minimum line time, then decays. Observed with s7 stopAt Warned on `RstJumper`. Measured: `MemoryStick` idle alpha 0.140, warning peak 0.950, fill peak 0.500; fill hold 0.575 s on `MemoryStick` and on `RstJumper`. RST bars were first 0.14 (callout) and 0.3 (box) and read as a filled block at the Fix frame, so they are now 0.12 and 0.2.
- Fix 2. Opening: `SymptomLabel` line 1 at size 68 on two lines, `SymptomNote` (new, 30 x 5.5, size 68) below the board with the caution sentence, off after the pinch. The DRAM light has a pulsing amber `LedGlow` disc and a 0.30 cm `LedHalo`. Two captures at uncontrolled pulse phase showed a dimmer and a brighter glow.
- Fix 3. `Screwdriver`: 16.2 cm long, approach 4 cm along (0.75, 0.6365, 0.177), starts inside the display band (s5a assertion) and is readable at the working view during the hold. `MonitorBody` has a closed flat frame on its +Z face. The look-up capture shows "No signal" inside a closed rectangle. `WaitCard`: height 12, up 13.9, row gap 0.3. Measured: card bottom tan 0.093, `XRayPierce` top tan 0.083. The Preview camera was restored with lookAt (rotation x reads 325).

Side effects and limits:
- The new Monitor frame shows at the working view: a bright bottom line and two side lines near row 290 to 197, about 10 px above the opening card. It stays clear of the card and the panels. Previously this was a faint dashed line.
- The tool shaft passes through the GPU corner in 3D. It draws depth-off, so it reads on top of the card.
- "Booting..." inside the frame was not captured. The approach start of the tool was asserted but not captured. The warning flash on `MemoryStick` and `Socket` was sampled by LEAF but not captured on screen.
- The glow's minimum and maximum are not captured; the LEAF check is the alpha ratio to the halo.
- A LEAF hover still skips the real cursor raycast, as noted in earlier rounds. A person did not do this pass.
- Still not done: the manual pass, the 16:9 frame check, listening to the sounds, the fast-sweep false-trigger check, the out-of-view chime, R14, render-audit Fixes 1, 2, and 7, device testing.

## Round 3 visual fixes and the W-12 DRAM light move, 2026-11-08

Tested tree: the code of commit f24fdab, with the temporary mutations removed and restored. Results are LEAF scenarios run one at a time in the Lens Studio Preview, read from the DefaultLeafScenarioManager log lines between 23:02:41 and 23:05:36. Input was the LEAF scripted interactor, not a person. Capture: `ClearCMOS-media/screens/round-3.png` (s6-band stopAt Fix, maxDimension 1100; the LEAF overlay text is on it). Preview camera: lookAt the board center, rotation x 325.

| Run | State | Passed | Failed | Detail |
|---|---|---|---|---|
| 1 | Final code of this round | 10 | 0 | s1-start, s2-anchor, s3-order, s4-refusal, s5a-jumper, s5b-battery, s6-band, s7-early-warning, s8-rst, s9-sound |

Mutation checks, one per new behavior. Each mutation was removed after its run. These prove that each assertion can fail. Assertions without a line here were not mutation-checked this round.
- `SAFE_GREEN` set to amber: s8-rst failed with `the CLR_CMOS callout color is {x: 1, y: 0.757, z: 0.302}, expected safe green #2EF2B8`.
- `XRAY_CALLOUT_RST_BAR_CM` 0.12: s8-rst failed with `the RST callout is heavier than the CLR_CMOS callout: mesh thickness 0.320 against 0.270`.
- Refusal fill removed in `ClearCmosPart.playRefusal`: s8-rst failed with `the RST box did not fill during the refusal, peak 0.00`.
- `FIX_PRIMARY_LANE_X_CM` 8.5: s3-order failed with `StepLabel is at x 8.50, expected -8.50`.
- `playSfx("chime")` removed: s2-anchor failed with `the out-of-view chime played 0 times, expected 1`.
- `TABLE_EDGE_ALPHA` 1: s1-start failed with `Table edge alpha is 1.00, expected 0.15 to 0.30`.
- `MONITOR_EDGE_QUIET_ALPHA` 1: s1-start failed with `Monitor edge alpha is 1.00 at step Symptom, expected 0.3`.
- `DONE_RING_HOLD_SECONDS` 0: s5a-jumper failed with `DoneRing was on for 0.869 s, expected about 1.5`.
- `LED_HALO_RADIUS_CM` 2.5: s1-start failed with `LedHalo radius is 2.50, expected 3.5`.
- `DramTag` text set to "Memory" in the editor, not saved: s1-start failed with `DramTag says "Memory"`.

Not mutation-checked this round: amber before the fix, `XRayJumper` green, `XRayBattery` amber, GPU label quiet alpha, RST no-go bar, no fill at rest, warning fill, fill clears after the warning, the short fallback line, the real-card caveat panel, the three-line final panel, and the s9-sound chime order.

Changes, observed on screen at 85 cm unless noted:
- Fix frame: at Step.Fix the CLR_CMOS callout and its real pins are the safe green, amber stays on the Battery. The RST callout rests as a red outline (thinner than the CLR_CMOS callout), and fills red only during the warning and the refusal. The `Or lift graphics card` line is short and secondary, to the right. The `Graphics card` silkscreen is at alpha 0.30 at the fix. `CLR_CMOS` label moved off the ribbon; `round-3.png` shows the ribbon reaching the cage without crossing the label.
- Edges: `Table` edge alpha is 0.22 and `Monitor` edge alpha is 0.30 until Training and 1 at Training and Done (log `Monitor edge alpha` lines).
- Done: `DoneRing` expands in 0.5 s, holds about 0.6 s, and fades over 0.4 s (s5a on-time check). The final panel shows `Simulated recovery: POST successful.`, `Monitor now shows the boot screen.`, and `Next: BIOS Setup, Load Optimized Defaults.` on three lines at text size 56 (captured, fits the 5.5 cm panel).
- Chime: `Chime.wav` plays once at the arrow out-of-view trigger. A second out-of-view event did not chime again in the log.
- W-12: `DramLed` moved to rig-local (-0.1, 0.8, 11.4) and `SymptomButton` to (-0.066, 17, 31.07), on the eye ray. s1-start measured `SymptomButton eye-ray gap to DramLed 0.00 cm`. `LedHalo` and `DoneRing` follow `DramLed`. `LED_HALO_RADIUS_CM` is 3.5. A small `DRAM` silkscreen tag (`DramTag`) sits beside the light and turns off with it at Done. At Fix, `round-3.png` shows the amber light and `DRAM` tag at the board center front, by the board art `CPU DRAM VGA BOOT` legend.
- Framing decision: Fix 2 pillarbox (see `recording-runbook.md` step 3). The 16:9 Preview was not verified, so the pillarbox replaces it.

U1 real-cursor pass (InjectPreviewGesture), run through a fresh Preview with the real SIK mouse path, not the LEAF interactor: real pinches on `SymptomButton`, `AnchorButton`, `PowerCord`, `Glass` (each needed one press to place the cursor before the pinch that counted) reached Step.Fix. A second press on Glass, 0.93 s after the first, lifted the GPU, so this pass ran with the card lifted. Real-cursor capture at Step.Fix with the cursor held on the RST callout, card lifted: `tool-results/mcp-lens-studio-blob-1794200507335-ro128i.jpg`. This is the known late-double-press limit from Round 1 and not a new defect.
- Sweep from the frame's left edge (the direction of `PowerCord`; the plug is outside the 85 cm frame on purpose) to the `Jumper` callout target, as a held drag released on the target: no `early warning` line.
- Rest on the `Jumper` callout after that release, 2 s: no `early warning` line and no step change.
- Rest on the `RstJumper` callout after a drag-release from an empty area: `sfx warning_tick at step Fix playing=true` and `early warning RstJumper at step Fix` at 23:02:20, with no refusal from the rest.
- Limits: the sweep ran as a held drag, because the tool's move events only update the cursor after a press and a held press does not dwell. So the fast-sweep check is a held drag, not a free hover. `InjectPreviewGesture` cancel on a resting target counted as a pinch and refused `RstJumper` twice (23:01:30, 23:02:08), then the drag-release gave the hover. No `CaptureRuntimeViewTool`, `QueryRuntimeSceneTool`, or `PreviewInteractTool` call was made.

Side effects and limits:
- Package count stayed 7. No popup. `.mcp.json` and `ls-live-instance.json` were not staged.
- A person has not done the manual pass, listened to the sounds, or checked the Lens on a device. R14 is still Missing. The 16:9 Preview remains unverified by choice (Fix 2).

## Warning before contact: wall and short line, 2026-11-08

Change: when the 350 ms dwell warning fires on a no-go part, a red wall (`NoGoWall`) rises around the part's no-go box over 0.2 s and stands 3 cm above it. The line reads `Stopped before contact.`. A pinch on the same part shows the part's own reason, shakes the part, and raises no wall. The dwell stays at 0.35 s.

Observed in the Preview (Step.Fix, `RstJumper`, 85 cm framing), using a temporary trigger that was then removed (0 `TEMP-VERIFY` lines left):
- The trigger called `updateEarlyWarning` directly with times past the dwell, so this is not a real-cursor result.
- Log: one `early warning RstJumper at step Fix` and one `sfx warning_tick at step Fix playing=true`.
- A capture during the warning shows the red wall at the RST pins and `Stopped before contact.` in the top lane.
- A capture after the hold shows the wall and fill gone and RST back to its outline.
- `RecompileTypeScriptTool` reported succeeded after the temporary lines were removed. `RunAndCollectLogsTool` showed no errors, only the `SceneMaterialBatcher` W line.

Tests changed in the same pass: `s4-refusal` and `s7-early-warning` now expect `Stopped before contact.` at the warning, and the part's own line after a pinch. `s7-early-warning` and `s8-rst` also check the wall height, and `s8-rst` checks that a refusal raises no wall. Results are in the next section.

### Verification (tester), 2026-11-08

LEAF, one scenario at a time in the Preview, scenario-manager PASSED lines: `s1-start`, `s2-anchor`, `s3-order`, `s4-refusal`, `s5a-jumper`, `s5b-battery`, `s6-band`, `s7-early-warning`, `s8-rst`, `s9-sound`. 10 of 10 passed. `s4-refusal`, `s7-early-warning` and `s8-rst` passed again after the temporary edits below were reverted.

Can the changed checks still fail? Four mutations, each run and then reverted (both scripts byte-identical to a backup copy afterward):
- Wall height above the box set to 0: `s7-early-warning` FAILED with `MemoryStick warning wall peaked at 4.60 cm, expected at least 5`.
- A refusal that raises the wall: `s8-rst` FAILED with `the RST refusal raised the warning wall, peak 3.45 cm`.
- Warning line changed to `Stopped.`: `s7-early-warning` FAILED with `RefusalLine says "Stopped.", expected "Stopped before contact."`.
- Wall that never clears: `s8-rst` FAILED with `the RST wall stayed up after the warning, height 6.45`.

Real-ray pass (`InjectPreviewGesture`, SIK mouse path, not the LEAF interactor). The Lens was at Step.Fix with the card lifted, reached by `s6-band` with `stopAt` Fix. No `CaptureRuntimeViewTool`, `QueryRuntimeSceneTool` or `PreviewInteractTool` call was made.
- Sweep from the frame's left edge (render-space 0.02, 0.52) to the `Jumper` callout (0.24, 0.56), as a held drag released on the target, then a rest of about 6 s: the log slice held no `early warning`, no `refused`, no `sfx` line and no step change. No false warning.
- Rest on the `RstJumper` callout after a drag-release from an empty area: one `early warning RstJumper at step Fix` and one `sfx warning_tick at step Fix playing=true` at 23:54:16, no refusal, and no second warning in the next 12 s of rest. Exactly one warning. This rest also shows that the injected input reaches the Lens, so the silent sweep is a real result.
- Two later attempts to re-arm put the press on `RstJumper`, because the cursor was already resting there. Each gave `refused RstJumper at step Fix` (23:54:29, 23:55:03) and no warning, since the cursor never left the box. These are pinches, not rests.
- Limit: the sweep is a held drag, because move events only update the cursor after a press. It is not a free hover. Render-space coordinates came from a Preview capture, and the `RstJumper` rest confirms they land.

Captures (Preview panel, `maxDimension` 1100, 618 x 1100). The images are not stored in the repo.
- Rest at Step.Fix: RST is a thin red outline, the top lane shows the step prompt.
- Warning: a capture at the production hold of 0.6 s landed 1.4 s after the warning (file time against log time), after the wall and fill had ended, and showed only the line. For the capture only, `EARLY_WARNING_MIN_LINE_SECONDS` was set to 3, then restored to 0.6. With that hold, a capture 1.1 s after a real-ray warning shows a tall red wall over the RST pins and `Stopped before contact.` in the top lane. Against the rest capture, 22.2 percent of pixels changed in the RST region and 10.0 percent in the text lane.
- Refused: a capture 1.1 s after a real pinch shows `RST is for restarting. The pins beside it clear the setting.` and no wall. Its flash and fill had already ended (0.3 s flash plus 0.25 s decay), so it shows the hover look only. Against the rest capture, 2.8 percent of pixels changed in the RST region and 14.2 percent in the text lane. The refusal's shake and fill, and the absence of a wall, are checked by `s4-refusal` and `s8-rst` and were not seen on screen.
- The warning wall's left edge overlaps part of the CLR_CMOS ring while the warning is up (seen in the warning capture).

State after verification: `EARLY_WARNING_MIN_LINE_SECONDS` is 0.6, the dwell is 0.35, 0 `TEMP-VERIFY` lines remain, and no scene file changed.

## Final proof, 2026-11-09

Objective: run every LEAF scenario on the current commit, one at a time, and save seven captures. The Lens was not changed.

Commit under test: `fb008ca422d7e9a2befaf6ff1d87793ce0c1fcb2`, the merge at the head of main after `git pull --no-rebase` said "Already up to date". The last commit that changed `Assets/` is `50fe1f4`, and `git diff 50fe1f4 HEAD -- Assets` is empty. The working tree was clean before the runs and after `project.save()`. `RecompileTypeScriptTool` reported succeeded before the first run.

Counts (Preview, LEAF scripted interactor, one scenario at a time, read from the `[DefaultLeafScenarioManager]` and overlay `PASSED` lines, 00:17:26 to 00:23:43 local log time):
- Full pass with default parameters: 10 of 10 PASSED, 0 FAILED. `s1-start` 4.737 s, `s2-anchor` 4.620 s, `s3-order` 12.714 s, `s4-refusal` 13.611 s, `s5a-jumper` 21.676 s, `s5b-battery` 25.935 s, `s6-band` 12.107 s, `s7-early-warning` 21.107 s, `s8-rst` 17.947 s, `s9-sound` 20.953 s.
- Six more runs to hold a frame for a capture: `s1-start`, `s6-band` stopAt Fix, `s7-early-warning` stopAt Warned, `s8-rst` stopAt Refused, `s6-band` stopAt Training, `s6-band` stopAt Done. 6 of 6 PASSED.
- Total: 16 of 16 runs PASSED, 0 FAILED. The log slice from the first run has 0 `E` or `F` lines. The only `W` lines are `SceneMaterialBatcher` (50 and 323 lines, the known baseline).
- Not counted: the log shows one earlier `s1-start` failure at 00:15:44, before this proof and on a tree that was different from the head (a merge landed at 00:16:25, and the log shows "TypeScript is not compiled" at 00:15:52). Exact text: `FAILED CHECK: DramLed is 26.80 cm from the status LED block, limit 0.6`, then `[s1-start] FAILED - AssertionError: Expected: "true" - Received: "false"`. The next `s1-start` run passed at 00:16:00. I did not investigate it further.

Captures: Preview panel, `maxDimension` 1100, 618 x 1100 (panel 1392 x 2474). Saved outside the repo in `ClearCMOS-media/screens/`. The images are not stored in the repo. Every one except `final-open.png` carries the LEAF overlay line `[ N s][id] PASSED` at the top. I viewed each file after saving.
- `final-open.png`: Step.Symptom after a Preview refresh and 3 s, no LEAF run. Shows the DRAM light with the line `BIOS change, then DRAM light and no signal for several minutes? Pinch the light.` and the note `If it just started, wait. Memory training can look like this.`
- `final-scan.png`: end of `s1-start`, Step.Anchor. Shows `Scan this PC (simulated)`.
- `final-fix.png`: `s6-band` stopAt Fix. Shows `Pinch CLR_CMOS pins` and `Or lift graphics card`, CLR_CMOS green, RST a red outline, Battery amber.
- `final-warning.png`: `s7-early-warning` stopAt Warned. Shows the filled red wall at RST and `Stopped before contact.` The test held this frame by calling `playWarningFlash(20)` on `RstJumper` after a LEAF hover.
- `final-refused.png`: `s8-rst` stopAt Refused. Shows `RST is for restarting. The pins beside it clear the setting.`
- `final-training.png`: `s6-band` stopAt Training. Shows `First boot: memory training may take several minutes. Time-lapsed`.
- `final-done.png`: `s6-band` stopAt Done. Shows `Simulated recovery: POST successful. Monitor now shows the boot screen. Next: BIOS Setup, Load Optimized Defaults.` The monitor text in the capture reads `Booting...`.

Seen in the captures, cause UNKNOWN, not investigated: in `final-fix.png`, `final-warning.png` and `final-refused.png` a green line runs from the CLR_CMOS part to the left edge of the frame and out of view.

Still unproven:
- A person did not do the manual pass. Input was the LEAF scripted interactor, not a mouse or a hand. This proof did not use `InjectPreviewGesture`.
- Real hover and pinch on the two pin pairs, and the fast-sweep false-trigger check, were not repeated on this commit.
- The 16:9 Preview was not tested. The panel is portrait (461 x 824 logical). The Preview scene was `Evening Room`.
- No device (Spectacles) test. No person listened to the sounds. `s9-sound` passing is a scripted check, not a listening result.
- No mutation check this round, because the Lens was not changed. Whether each scenario can still fail on this commit was not re-measured.
- The captures show one moment per step. Anything animated (halo, flash, wall, ribbon) was not judged at a second timestamp.

## Feature freeze, 2026-11-09

Objective: record the LEAF count for the frozen build, with the limits of that run.

Commit under test: `517291da8b5c7e5ebf661be8d888f60d25870b05` (`517291d`), tag `leaf-freeze`. The commit shortens the on-screen text, tightens the arrow and refusal timing, and adds collider and rebuild checks. Commit `f5d7bf6` on top of it changes one coordination note under `devpost/` and nothing under `Assets/` or `Packages/`.

Source of this section: the tester's report of the LEAF runs and the diff of `517291d`. This pass wrote the section and did not run LEAF again.

Result: 10 of 10 scenarios passed, 0 failed. Ids: `s1-start`, `s2-anchor`, `s3-order`, `s4-refusal`, `s5a-jumper`, `s5b-battery`, `s6-band`, `s7-early-warning`, `s8-rst`, `s9-sound`.

How the run was made:
- Lens Studio Preview, one scenario at a time.
- Input was the LEAF scripted interactor. No person gave input and no device was used.
- The Preview ran at about 24 fps in that session. Because of that, the tester lowered two sampling floors in `Assets/Tests/ClearCmosTestSupport.ts`, in the same commit:
  - `SHAKE_SEEN_CM` from 0.02 to 0.005. At 24 fps one sample can land on a zero crossing of the shake tail and end the span early.
  - `SCREWDRIVER_MIN_TRAVEL_CM` from 2 to 1.5. The comment beside it records 2.65 to 2.71 cm in earlier logs and 1.8 to 2.1 cm at a 24 fps Preview.
- The tester kept the duration bounds of 0.15 s to 0.5 s for the shake and the flash (`ClearCmosTestSupport.ts`, the two `> 0.15 && < 0.5` checks).
- Mutation checks: the tester's report records them as passed, for 12 assertions. This pass did not repeat them and does not copy the per-assertion output.

Limits of this count:
- The lower floors accept a smaller shake offset and a shorter screwdriver approach than the earlier runs did. A pass at 24 fps does not show the earlier thresholds.
- The short-line assertion is still unproven on its own. No result in this record shows it failing by itself.
- A scripted interactor pinch forces its target and ignores colliders. The commit adds collider checks in `s1-start`, `s3-order` and the shared `finishAfterFix` helper to cover that gap. They are part of the 10 of 10.
- This record holds no result from a person and none from a device.

## Real mouse rest on leaf-freeze, 2026-11-09
Tested on tag `leaf-freeze` in the Lens Studio Preview with the real Windows cursor moved by the operating system, no mouse button pressed, no person at the controls.
- RST pins at Step.Fix: `early warning RstJumper at step Fix` logged at 07:38:26, with the red wall and "Stopped before contact." visible in a screen grab.
- Memory sticks at Step.Fix: `early warning MemoryStick at step Fix` logged at 07:39:11.
- An earlier automated pass through InjectPreviewGesture produced no warning from bare moves. Those moves do not produce real hover.
- Still unproven: feel with a person at the controls, and any device.
