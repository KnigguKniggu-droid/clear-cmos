# Brief iterations: Clear CMOS

Source: devpost/design-brief.md (not edited). Numbers marked "interpolated" are my arithmetic from Snap's published usable-area figures. Exact values are UNKNOWN.

## Round log

**Round 1 (is this just a video on glasses?)**
- Top flaw: a guided checklist on a generic model reads like a video with buttons. The glasses-only value ("what is safe on this exact spot") was claimed but not shown.
- Made: the marks stay anchored to parts at real scale. A faint ghost outline of the battery shows through the heatsink at the heatsink step ("the answer is buried"). No new interaction.

**Round 2 (scope and CLAD feasibility)**
- Top flaw: about 10 removals (screws, riser cables, GPU power cables) with models, animation, colliders and tests. Too much for 1 to 2 hours. Your story never mentions removing cables.
- Made: cut screws and all cable steps. 7 targets remain, built from primitive shapes. Rejected: cutting the power-cord step (safety is your biggest fear).

**Round 3 (placement and field of view)**
- Top flaw: a 30.5 x 24.4 cm board at 55 cm exceeds the 23 cm usable height there. A fixed 75 cm world height ignores where the user sits.
- Made: board center about 70 cm from the eyes, about 35 degrees below straight ahead, placed relative to the user's start. Usable area there is about 31 x 49 cm (interpolated). Colliders 3 cm = 2.5 degrees, above the 2 degree minimum.

**Round 4 (interaction count and preview reliability)**
- Top flaw: "grab and drag" on four parts plus pinch elsewhere makes two verbs. Mouse drag is the least reliable input.
- Made: pinch for every part. The battery is the only drag (3 cm threshold). Rejected: a second input path for each step. Fallback for the drag goes in Risks.

**Round 5 (show-and-hide timing, clutter)**
- Top flaw: status card, label, why line, timer, arrow and rings could all be on at once. The tag-along card duplicates the label and cannot be judged well in preview.
- Made: deleted the status card. The label carries "Step 3 of 6". At most one ring and one label at a time. Timer and why line share one card over the socket. Fade-in about 1 s, fade-out 0.3 s, feedback on hover instant.

**Round 6 (fear and safety moment, memorability)**
- Top flaw: the fear of breaking the battery got only a generic refusal. Nothing made the battery step feel safe.
- Made: green safe edge on the battery, red on the rest. After the lift the battery rests on a green pad. The memory sticks are a refused decoy (the DRAM light points at them; your cause was a BIOS setting). Rejected: a "battery breaks" fail animation (scope, no score gain).

**Round 7 (3-minute video, first 10 seconds)**
- Top flaw: the brief began at a static PC. No hook, and no place for the Technical Implementation evidence (CLAD, MCP, LEAF).
- Made: the Lens opens already in the dead state, with no title or click. Added a timed video path. Rejected: in-Lens narration or intro screen (video voice-over does that).

**Round 8 (cut and make LEAF-testable)**
- Top flaw: done criteria said "I see". They had no object names, and the 10 s wait is slow to test.
- Made: criteria rewritten as named-object checks. The wait duration is a setting so LEAF can use 1 s. Criterion 6 is marked manual. Cut "Voice: none" (duplicate). Rejected: a Reset button for retakes.

Build-notes changes needed outside this range (the build notes stay unchanged in the brief for now): say primitive shapes are fine, name the scene objects as listed in Done criteria, and expose the wait duration as an input.

---

## The one spatial moment
A BIOS change has left your PC dead: the DRAM light is on, the screen says no signal, and you are afraid of breaking something. The PC lies flat on the table with its glass off. The Lens leads your hands through the only parts in the way, to a CMOS battery buried under the graphics card and heatsink. It marks what is safe to touch and what is not.

## Why it belongs on glasses
- Uses: draws in the world (marks sit on your own parts at real size) and leaves your body free. On real glasses it would also share your view of your own board.
- Why it's better than the phone or laptop version: both hands are inside the case. The answer is a physical location buried under other parts. A video cannot show which spot on your board is safe. The real problem: the fix took minutes, but with no way to see where to go, the PC stayed dead for months.

## Product or overlay
- Type: overlay in the real version; a guided product in this version.
- What the real version would sense: your actual motherboard and which part you are touching.
- Stand-in for the preview: a real-size virtual PC modeled on a Gigabyte B650 AORUS PRO AX with an RX 7900 XT on a virtual table. Primitive shapes are enough. The fault is hard-coded. No recognition is faked at runtime.

## Where things live
- Where the user looks during the main task: down at the open board, about 35 degrees below straight ahead (default).
- Board: flat on a virtual table, center about 70 cm from the eyes (default). The table is placed relative to the user's start position, not at a fixed world height. Real size: motherboard 30.5 x 24.4 cm. Usable area at 70 cm is about 31 x 49 cm (interpolated from Snap's figures; exact UNKNOWN), so the whole board fits.
- Modeled parts only: glass panel, power cord, graphics card, heatsink, memory sticks, battery socket with battery, case power button.
- Monitor: about 35 cm behind the far edge of the board, tilted toward the user, so it sits in the upper part of the same view (default).
- Power-cord plug: about 45 cm left of the board, outside the view on purpose (see out-of-view cue).
- Step label: on the part it is about. One short line starting with "Step n of 6". Text 2 cm or taller, light text on a panel (default).
- Safe and danger marks: on the board. Green ring on the part to touch. Red outline on what not to touch.
- Battery: green mark on the safe edge, red on the rest of the battery and socket. A green pad beside the socket is where the battery rests.
- No status card, no menu, nothing locked to the face.

## Hands and input
One gesture for everything except the battery: pinch (mouse click in the preview).
1. Power cord: pinch the plug. The cord unplugs.
2. Glass: pinch. It lifts away.
3. Graphics card: pinch. It lifts away.
4. Heatsink: pinch. It lifts away.
5. Battery: pinch, then drag it at least 3 cm out of the socket from the marked safe edge. It then rests on the green pad. This is the only drag.
6. Rebuild: pinch one big button. Parts return in reverse order by animation (default).
7. Power on: pinch the case power button (active only after Rebuild).
- Targets are at least 3 cm and highlight when aimed at. Buttons 4 cm (default). Gaps between targets at least 1.5 cm.
- Decoys that refuse a pinch: memory sticks, the red part of the battery and socket, and any part that is not the next step.

## When things show
- Next step's green ring and label: fade in over about 1 s when the step becomes next. The old ring and label fade out over 0.3 s. Only one of each at a time.
- Ghost battery: a faint battery outline shows through the heatsink at the heatsink step only.
- Red outline: appears at once on hover of a decoy. A pinch is refused with a soft buzz and one line, for example "Not there. Use the marked edge." On the memory sticks: "Leave the memory alone. The cause was a saved BIOS setting."
- Wait card over the empty socket: appears when the battery leaves. It shows the countdown, "real wait: a few minutes", and one line: "The battery keeps the BIOS settings alive. Removing it clears the bad change." Wait length is a setting, default 10 s (default). It hides when the countdown ends, and then the Rebuild button appears.
- Out-of-view cue: at start, a chime and a small world-space arrow point toward the power-cord plug. The arrow hides when the cord is unplugged.

## Done criteria
Each one is checked in the Lens Studio preview. Object names are the names CLAD gives the scene objects. Criteria 1 to 5 get a LEAF scenario. Criterion 6 has no LEAF test.
1. Start state: after the Lens starts, `DramLed` is on, `MonitorScreen` shows "No signal", the plug `PowerCord` has the only green ring, and `StepLabel` reads step 1 of 6.
2. Order: triggering `PowerCord`, `Glass`, `GPU`, `Heatsink` in that order removes each one (hidden or moved away). After each removal, exactly one next ring and one label are on.
3. Refusal: triggering `MemoryStick` or any part that is not next leaves it in place, keeps the step number, and turns on `RefusalLine` with non-empty text. Hovering `MemoryStick` turns on its red outline.
4. Battery: at step 5, triggering the red part of `Battery` is refused. Dragging `Battery` at least 3 cm from the safe edge moves it to `BatteryPad`, turns on `WaitCard` (countdown and why line), and with the wait set to 1 s, `RebuildButton` turns on after it ends.
5. Finish: triggering `RebuildButton` puts every part back with `Battery` in the socket. `PowerButton` before Rebuild is refused. After Rebuild, triggering `PowerButton` turns `DramLed` off and `MonitorScreen` shows a boot screen.
6. Manual, no LEAF test: in the Center preview view at start, the whole board and the monitor are visible, text is readable, and nothing sits at the edge of the view.

## Video path (3 minutes or less)
- 0:00 to 0:10: the Lens is already running in the dead state (DRAM light on, "No signal"). Say what happened: a BIOS setting (Secure Boot) was changed, the PC would not boot, the DRAM light stayed on, and you used a laptop for months.
- 0:10 to 0:30: say why it needs glasses: both hands in the case, the answer is buried, and the fear of breaking a part. Show the chime and arrow to the power cord.
- 0:30 to 1:50: walk the steps. Include one refused wrong grab (memory sticks), the marked safe edge on the battery, and the wait card.
- 1:50 to 2:15: Rebuild, power on, DRAM light off, boot screen. Say the fix took minutes after months.
- 2:15 to 2:50: show how it was built: CLAD, Lens Studio MCP, and the real LEAF pass and fail result. Do not stage the result.

## Out of scope
- Recognizing a real board, other motherboards, other PC failures, real BIOS menus, voice, persistence between sessions.
- Removing screws, disconnecting cables, a virtual screwdriver, a status card, in-Lens narration, a Reset button.

## Risks and open questions
- The exact battery position and heatsink layout on the B650 AORUS PRO AX must be checked against Gigabyte's manual before modeling. UNKNOWN today.
- Which heatsink covers the battery on this build: UNKNOWN; confirm from the real PC. The ghost battery outline is only as accurate as that answer.
- Usable-area numbers at 70 cm are interpolated. Confirm fit in the Center preview view.
- The battery drag is the one non-pinch gesture. If it is unreliable in the preview or in LEAF, replace it with a pinch and keep the lift animation.
- Real safety: the real procedure requires unplugging power first and handling parts gently. The Lens teaches this, but it is not a professional repair guide.
- Feel unproven: comfort, real hand tracking inside a case, and whether labels stay readable on real glasses.
