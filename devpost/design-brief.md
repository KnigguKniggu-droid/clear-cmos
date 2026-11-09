---
status: approved
---

# Design brief: Clear CMOS (default name)

> Note: some internal notes named in this document are not included in this public snapshot.

## Vision and scope
The vision: an AR assistant for people afraid to work on their own PC hardware. This build proves one job on one board: Rescue mode. Claim only: a PC-specific guide built from a real dead-PC reset, with an early warning when the reach lingers in a no-go zone. X-ray views and blocking wrong steps already exist elsewhere; see devpost/research/competitor-check.md.

## The one spatial moment
A BIOS change has left your PC dead: the DRAM light is on, the screen says no signal, and you are afraid of breaking something. You look at the open PC, the board shows through the parts on top, and the Lens finds the shortest safe path to the reset, refusing your hand when you reach for the wrong part.

## Why it belongs on glasses
- Uses: shares your view (the real version looks at your own PC), draws in the world (marks and X-ray sit on the parts at real size), leaves your body free (both hands stay in the case).
- Why it's better than the phone or laptop version: the answer is a physical location buried under other parts, and a video can't stop your hand or show what is under your own graphics card. The real problem: the fix took minutes, but with no way to see where to go, the PC stayed dead for months.

## Product or overlay
- Type: overlay.
- What the real version would sense: your actual motherboard and which part you are reaching for.
- Honest label: the video and Devpost text say "recognition simulated"; the mouse stands in for the hand.
- Stand-in for the preview: a real-size virtual PC modeled on a Gigabyte B650 AORUS PRO AX with an RX 7900 XT on a virtual table, and an obvious "I'm looking at my PC" button that fakes recognition. Primitive shapes with labels are enough. The fault is hard-coded.

## Where things live
- Where the user looks during the main task: down at the open case, about 35 degrees below straight ahead (default).
- PC: lying flat on a virtual table, board center about 85 cm from the eyes so the whole board fits the display band, placed relative to the user's start (default). Board 30.5 x 24.4 cm.
- Monitor: about 35 cm behind the far edge of the board, tilted toward the user (default).
- Power-cord plug: about 45 cm left of the board, outside the view on purpose (default).
- Step label: on the part it is about, one short line, text 2 cm or taller, light text on a panel (default).
- X-ray: the jumper and battery glow through the parts on top, on the board at true position.
- Nothing is locked to the face. No status card, no menu.

## Hands and input
Pinch (mouse click in the preview) for everything except the battery.
1. Opening: one pinch on the glowing DRAM light itself (keep the object name `SymptomButton` on this target). A label beside it says: "DRAM light on and no signal for several minutes? Pinch the light." Under it: "If it just started, wait. Memory training can look like this."
2. Anchor: pinch "I'm looking at my PC". X-ray turns on.
3. Power cord: pinch the plug. Nothing else can be touched until this is done.
4. Glass: pinch. It lifts away.
5. Graphics card (battery route only): pinch. It lifts away. Its label says the real card also has a screw, a latch, and power cables.
6. The fix: pinch the `CLR_CMOS` jumper, the default route (a short animation shows a metal screwdriver shorting the two pins). Labeled fallback: lift the graphics card if it is in the way, then drag the battery at least 3 cm from its marked safe edge onto a green pad.
7. Rebuild: pinch one big button. Parts return by animation (default).
8. Power on: pinch the case power button.
- Targets at least 3 cm, buttons 4 cm, gaps at least 1.5 cm; they highlight when aimed at (default).
- Decoys that refuse: memory sticks, the red part of the battery and socket, any part that is not next.

## When things show
- Green ring and label: only for what is next. Fade in about 1 s, out 0.3 s. At most one ring, except the two at the fix.
- X-ray: from Anchor until the fix is done.
- Red outline: on hover of a decoy. A pinch is refused with a soft buzz and one line. Memory sticks say: "Leave the memory alone here. This light came from a saved BIOS setting."
- Centerpiece, to be polished first: one wrong reach, reactive red zone, blocked grab, corrected safe route.
- Early warning: when the cursor stays in a no-go box at full proximity for 350 ms, play the flash and the refusal line once, before any pinch, with a 2 s cooldown per box. Pinch refusal and shudder stay as they are. Pitch line: "It warns before your hand gets there."
- Every label is clamped inside the display band, using the same placement as the refusal line.
- Scene label, always visible near the PC: "Simulated PC layout. Visual guidance only."
- Memory training ending: after Power on, the DRAM light stays on with "First boot after a reset can take several minutes. Do not touch it.", time-lapsed, then it goes off and the boot screen shows.
- Wait card over the socket: after the fix. Countdown time-lapsed to 10 s (default), "time-lapsed", and one line: "This clears the saved BIOS settings, including the bad change." Then the Rebuild button appears.
- Safe-path ribbon: after Anchor, a glowing line draws itself over about 1 s from the power cord to the reset, routed around translucent red no-go boxes over the memory and other parts. It stays until the fix.
- Proximity: red no-go boxes strengthen as the cursor nears them (a stand-in for real hand distance).
- Refusal shudder: a refused part shakes for 0.3 s and its no-go box flashes.
- Out of view: a chime and small world-space arrow point to the power cord, in any direction, until it is unplugged.

## Build priority (highest first)
These are promised in the video and Devpost text, so they come before polish:
Tests must match the brief. When a behavior changes, update its LEAF scenario in the same round, using the required tests in devpost/research/verification-1.md. A green test on old behavior does not count, and a scenario must be able to fail.
1. Early warning before the pinch, because it is our core distinct claim.
2. Jumper is the default step directly after Glass, with s3-order updated.
3. DRAM light visible at the working view, as the opening pinch and the ending.
4. First-boot hold and ending.
4a. Calm first-boot hold: build section 2 of devpost/research/council.md.
5. "Scan this PC (simulated)" label, the scene label, and the screwdriver animation.
6. Label collisions, clipping, and filled blobs, per devpost/research/visual-punch-list.md when present.
7. RST wrong-reach: CONFIRMED by William by eye on manual p.4 (see TEAM_LOG.md). Build section 1 of devpost/research/council.md, using the geometry in Board facts, and make it the filmed wrong reach.
7a. Board art: use origin/william/art-textures art/textures/board.svg when it exists; otherwise import art/backup/board.svg with ConvertSvgToTexture as line art on black. Its part positions are estimates, so never claim them as exact.
8. Audio: when the visuals above are done, import the WAVs from art/sfx/ (see its README) and play each at its moment, replacing the old buzz and chime. A person still has to listen and approve them.
Feature freeze: Sunday Nov 8, 11:00 PM CST. Hard build freeze: Monday Nov 9, 8:00 AM CST. If the build regresses, revert to the last commit that passed all LEAF scenarios.

## Visual notes after Sprint A (from the real capture)
- Hologram edge lines read dim and flat. Raise edge brightness to full #7ADFFF and reserve dimming for the X-ray moment only.
- The board is nearly invisible at the working view; apply the board line art so it reads clearly.
- The instruction panel overlaps the glass panel; keep panels clear of parts.

## Board facts from the manual (see devpost/research/board-layout.md, positions are ESTIMATE from p.4)
- RST and CLR_CMOS are two 2-pin headers about 2.0 cm apart diagonally in the bottom-right corner. The 4.5 cm spacing in council.md is wrong; use the Lens-frame numbers in board-layout.md. William confirmed RST by eye on manual p.4.
- Two pin pairs 2 cm apart cannot both have 3 cm targets. If RST is built, make the pinch targets in the magnified callout, where the pins are 3x further apart.
- CLR_CMOS is not covered by the graphics card. The DRAM status LED stays visible with a card installed, at the right edge. Which of the four status LEDs is DRAM is UNKNOWN, so label only the one we light as DRAM.
- DRAM is the second status LED in the legend, inferred as top-right of the 2 x 2 block. The panel ruled that DramLed stays where it is framed for the opening and ending; the page says placement is illustrative.
- Never label the debug lights D_LED; on this board D_LED headers are RGB strips. Use the manual's "CPU DRAM / VGA BOOT" legend.

## Wording decisions
- Wait card: remove "real wait: a few minutes"; show "Time-lapsed." The sources disagree on wait times.
- "Only one clears the setting" describes the pins, not our product, so it stays.
- "RX 7900 XT" stays as a plain descriptive label with no logo.

## Judging panel fixes (devpost/research/panel-1.md, apply its lens items in order)
- The X-ray must be a real reveal: hide the CLR_CMOS and Battery labels until the scan, give the GPU shell and Glass a 20% #7ADFFF fill that fades at the scan, and make the marks bold amber.
- Use the panel's exact positions for Jumper, Battery, GPU, the callout, and RstJumper. The RST cutoff is 9 PM CST; if missed, film the memory fallback.
- Use the panel's strings, including "Time-lapsed." and "Next: BIOS Setup, Load Optimized Defaults.", and rename "RX 7900 XT" to "Graphics card". This replaces the earlier decision to keep that label.
- Full-brightness #7ADFFF edges, a chassis outline, a larger arrow with a shaft, and screwdriverHoldSeconds of 2. Check a 16:9 frame.

## Audit decisions (these override visual-direction.md where they differ)
- Occluders: depth-only material (color write off, depth write on), tested on one part first. Fallback: 15% opacity #111827 shell.
- Ribbon draws in about 1000 ms.
- Early warning: 350 ms dwell inside a no-go box, shown for at least 600 ms, 2 s cooldown per box.
- Jumper: during X-ray, a 3x magnified callout sits beside the real jumper, labeled CLR_CMOS. Pads flash #6BFF9E for 150 ms on contact. No particles.
- Second button reads "Scan this PC (simulated)". Keep the object name `AnchorButton`.
- Ending: DRAM light holds with "First boot: memory training may take several minutes.", time-lapsed. Then it goes out and one 500 ms #7ADFFF ring fires from the DRAM light. No socket shockwave. Final label: "Simulated recovery: POST successful."

## Done criteria
Each one can be checked in Lens Studio's preview. Criteria 1 to 5 get LEAF scenarios; 6 is manual.
1. Start: `DramLed` on, `MonitorScreen` shows "No signal", `SymptomButton` visible.
2. Anchor: after the symptom and `AnchorButton`, `XRay` is on, `Arrow` points to `PowerCord`, and only `PowerCord` has a ring.
3. Order: `PowerCord` then `Glass` each move away, with exactly one next ring and label after each; `Jumper` is then the default next step, and `GPU` is only required for the battery route.
4. Refusal: triggering `MemoryStick` or any part not next leaves it in place, keeps the step, and turns on `RefusalLine` with text.
5. Fix and finish: either `Jumper` or dragging `Battery` to `BatteryPad` turns on `WaitCard`; with wait set to 1 s `RebuildButton` turns on; `RebuildButton` then `PowerButton` shows the training message with `DramLed` still on, then after its time-lapse turns `DramLed` off and `MonitorScreen` shows a boot screen. `PowerButton` before Rebuild is refused.
6. Manual: at the working view, the next target, its label, and any refusal line are fully inside the display band. The monitor is checked with a look up.

## Video path (under 3 minutes)
- 0:00 to 0:20: already running, dead state. The story: a BIOS setting was changed, it would not boot, and it stayed that way for months.
- 0:20 to 0:40: why it needs glasses, the X-ray, the arrow to the power cord.
- 0:40 to 1:00: one deliberate wrong grab and the refusal.
- 1:00 to 2:00: the fix, the time-lapsed wait, the boot.
- 2:00 to 2:50: how it was built: CLAD, the Lens Studio MCP, and the real LEAF results.

## Out of scope
- Build mode, unless all LEAF criteria pass and a full Rescue video is recorded with at least 8 hours left. Then only the CPU power cable.
- Recognizing a real board, other motherboards, other failures, real BIOS menus, voice, memory between sessions, screws, cables, heatsink removal, a Reset button.

## Risks and open questions
- Possible stronger decoy: if the board manual shows an RST jumper beside `CLR_CMOS`, the wrong-jumper reach becomes the main wrong reach. UNKNOWN until the layout page is read.
- Known code bugs and gaps to fix first: devpost/research/code-stress-test.md.
- Jumper and battery positions on the B650 AORUS PRO AX are UNKNOWN; sibling Gigabyte manuals list a `CLR_CMOS` jumper. Confirm on the real board and move them if needed.
- ChatGPT cites the manual as placing the jumper near the lower-right board edge, so reachable with the card installed; sibling manuals list the jumper. Not independently verified. Confirm on the real board.
- Wait times differ by source, so the Lens shows no specific reset wait. It says only: "First boot after a reset can take several minutes."
- The usable area at 70 cm is interpolated from Snap's figures; confirm in the Center view.
- If the battery drag is unreliable in the preview or LEAF, replace it with a pinch.
- Real safety: unplug power first and handle parts gently. This is not a professional repair guide.
- Feel unproven: comfort, real hand tracking inside a case, label readability on real glasses.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Drive the flow from a data table of steps (id, target, allowed parts, label, refusal text) on one part registry, so another job can be added later. Primitive shapes with labels are fine. Use the scene object names in Done criteria. Expose the wait duration as an input so LEAF can use 1 s.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources

## As built: what changed from this brief

The approved body above is unchanged. This section lists the sentences that no longer match the build at tag `leaf-freeze` (commit 517291d). The line numbers refer to the body above. The text is from the skill pack audit of this build, updated to the frozen strings.

| Line | Sentence in the brief | As built at the freeze |
|---|---|---|
| 21 | "...with an RX 7900 XT on a virtual table, and an obvious "I'm looking at my PC" button..." | "...with a graphics card on a virtual table, and an obvious "Scan this PC (simulated)" button..." |
| 28 | "Step label: on the part it is about, one short line, text 2 cm or taller..." | Step label: one short line in the panel lane above the board, in line with the part, text size 64 (about 1.5 cm by the size hint), light text on a panel. The step lines are "Unplug the power cord", "Lift the glass side panel", "Pinch CLR_CMOS pins", "Drag battery to green pad" and "Press the power button". |
| 34 | "A label beside it says: "DRAM light on and no signal for several minutes? Pinch the light."" | A label says: "DRAM light stuck on? Pinch it." The note under it says: "If it just started, wait. Memory training can look like this." |
| 35 | "Anchor: pinch "I'm looking at my PC". X-ray turns on." | "Anchor: pinch "Scan this PC (simulated)". X-ray turns on." |
| 38 | "Its label says the real card also has a screw, a latch, and power cables." | Its label says "Or lift graphics card". After the card lifts, a panel below the board says "Real card: screw, latch, power cables." |
| 48 | "A pinch is refused with a soft buzz and one line. Memory sticks say: "Leave the memory alone here..."" | A pinch is refused with `refusal_thud` and one line that shows for 2.5 s (`refusalSeconds`). Memory sticks say: "Try the BIOS reset first." A part that is not the next step says: "Follow the green ring first." The RST pins say: "RST restarts. Use CLR_CMOS." |
| 53 | "...with "First boot after a reset can take several minutes. Do not touch it.", time-lapsed..." | "...with "First boot may take minutes. Time-lapsed"..." A second press on the power button during the hold shows "Give memory training several minutes." |
| 54 | "Wait card over the socket: after the fix." | Wait card in the panel lane above the board, left of center (`WAIT_CARD_X_CM` -5, `WAIT_CARD_UP_CM` 13.9): after the fix. Its lines are "Time-lapsed." and "Clears saved BIOS settings." |
| 76 | "Raise edge brightness to full #7ADFFF and reserve dimming for the X-ray moment only." | Board and GPU edges are full #7ADFFF; the `Table` edge stays at alpha 0.22 and the `Monitor` edge at 0.3 until Training. `recordingMode` also dims the chassis to 0.2, the table to 0.12, and hides the idle monitor frame. |
| 83 | "...stays visible with a card installed, at the right edge." | "...stays visible with a card installed, at the center of the front edge." |
| 84 | "The panel ruled that DramLed stays where it is framed for the opening and ending..." | Round 3 moved `DramLed` to the status-LED block position (-0.1, 0.8, 11.4) (`build-log.md`, Round 3); the page still says placement is illustrative. |
| 90 | ""RX 7900 XT" stays as a plain descriptive label with no logo." | Deleted. The scene label reads "Graphics card". |
| 93 | "...and make the marks bold amber." | "...and make the marks bold amber until the fix; at the fix the CLR_CMOS marks turn safe green #2EF2B8 and the RST marks rest as a thin red outline." |
| 104 | "...one 500 ms #7ADFFF ring fires... Final label: "Simulated recovery: POST successful."" | "...one #7ADFFF ring runs 1.5 s (0.5 expand, 0.6 hold, 0.4 fade). Final panel, in green text: "Simulated recovery: POST successful.", "Monitor now shows the boot screen.", "Next: BIOS Setup, Load Optimized Defaults."" |
| 107 | "Criteria 1 to 5 get LEAF scenarios; 6 is manual." | "Criteria 1 to 5 get LEAF scenarios; 6 is partly automated by s6-band, and the manual pass is pending." |
| 127 | "Possible stronger decoy... UNKNOWN until the layout page is read." | RST is confirmed (Brief:70) and built as `RstJumper`, the filmed wrong reach. The warning before contact reads "Stopped before contact." |
| 131 | The sentence after "It says" that quotes "First boot after a reset can take several minutes." | "First boot may take minutes." |
| 132 | "The usable area at 70 cm is interpolated from Snap's figures..." | The usable area at 85 cm (about 39 x 59 cm) is interpolated from Snap's figures; confirm in the Center view. |
| 144 | "Drive the flow from a data table of steps (id, target, allowed parts, label, refusal text) on one part registry..." | Drive the flow from the `Step` enum (`ClearCmosFlow.ts`) and `setStep` and `onPartPinched` in `ClearCmosMain`, on one parts list. |

Source of the frozen strings: `Assets/Scripts/ClearCmosMain.ts` and `Assets/Scene.scene` at 517291d. The count at that commit is 10 of 10 LEAF scenarios, with scripted input (`build-log.md`, Feature freeze).
