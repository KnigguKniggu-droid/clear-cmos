// ClearCmosMain.ts
// Owns: the current Step and all flow decisions; places the rig relative to the user's start.
// Inputs: typed handles to the authored parts, UI modules, and meshes; waitSeconds (LEAF sets 1).
// Must not: author text or UI. It pushes state to the UI modules and listens to their events.
// This object must stay last under ClearCmos so other scripts run their startup first.

import { InteractionManager } from "SpectaclesInteractionKit.lspkg/Core/InteractionManager/InteractionManager"
import { Interactor, InteractorInputType, InteractorTriggerType } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import { Step } from "./ClearCmosFlow"
import { ClearCmosPart } from "./ClearCmosPart"
import { ClearCmosArrow } from "./ClearCmosArrow"
import { ClearCmosNextCue } from "./ClearCmosNextCue"
import { ClearCmosActionButtonUI } from "./ClearCmosActionButtonUI"
import { ClearCmosLabelUI } from "./ClearCmosLabelUI"
import { ClearCmosWaitCardUI } from "./ClearCmosWaitCardUI"
import { ClearCmosMonitorUI } from "./ClearCmosMonitorUI"
import { buildLeader, applyMeshKit, buildCage, buildFlatBar, buildPadDiscs, buildPinPairCallout, buildPierce, buildScrewdriver, buildThinRing, findEdgeLines } from "./ClearCmosMeshKit"
import animate, { CancelFunction } from "SpectaclesInteractionKit.lspkg/Utils/animate"

/** The seven sounds from art/sfx/README.md, with its starting volumes. Each sound means one thing and has one moment. */
const SFX = {
  warning_tick: { track: requireAsset("../GeneratedSFX/warning_tick.wav") as AudioTrackAsset, volume: 0.8 },
  refusal_thud: { track: requireAsset("../GeneratedSFX/refusal_thud.wav") as AudioTrackAsset, volume: 1 },
  step_confirm: { track: requireAsset("../GeneratedSFX/step_confirm.wav") as AudioTrackAsset, volume: 0.7 },
  xray_sweep: { track: requireAsset("../GeneratedSFX/xray_sweep.wav") as AudioTrackAsset, volume: 0.8 },
  ribbon_draw: { track: requireAsset("../GeneratedSFX/ribbon_draw.wav") as AudioTrackAsset, volume: 0.6 },
  jumper_contact: { track: requireAsset("../GeneratedSFX/jumper_contact.wav") as AudioTrackAsset, volume: 1 },
  boot_ring: { track: requireAsset("../GeneratedSFX/boot_ring.wav") as AudioTrackAsset, volume: 1 },
  chime: { track: requireAsset("../GeneratedSFX/Chime.wav") as AudioTrackAsset, volume: 0.7 },
}
type SfxName = keyof typeof SFX

/** SIK has no registration event, so the interactor list is re-read at this interval instead of every frame. */
const INTERACTOR_LIST_REFRESH_SECONDS = 1
const RIBBON_SECONDS = 1
const RIBBON_SEGMENTS = 48
const RIBBON_HALF_WIDTH_CM = 0.14
const RIBBON_Y_CM = 1.4
const RIBBON_COLOR = new vec4(0.18, 0.949, 0.722, 0.95)
const RIBBON_RENDER_ORDER = 13
const XRAY_COLOR = new vec4(1, 0.757, 0.302, 1)
const XRAY_IGNITE_SECONDS = 0.25
const XRAY_SCAN_SECONDS = 0.9
const XRAY_SCAN_FROM_X_CM = -15.5
const XRAY_SCAN_TO_X_CM = 15.8
const XRAY_SCAN_Y_CM = 7.55
const XRAY_SCAN_Z_CM = 6.5
const XRAY_SCAN_WIDTH_CM = 0.2
const XRAY_SCAN_LENGTH_CM = 11.5
const XRAY_RENDER_ORDER = 13
const XRAY_JUMPER_SCALE = new vec3(2.6, 1.4, 2)
const XRAY_JUMPER_BAR_CM = 0.25
/** The ring is 0.3 cm wide at its 1.5 cm radius, so it reads as a bold mark. */
const XRAY_BATTERY_RING_INNER = 0.8
const XRAY_BATTERY_SCALE = new vec3(1.5, 1, 1.5)
const XRAY_PIERCE_TOP_CM = 7.5
const XRAY_PIERCE_BOTTOM_CM = 1.4
const XRAY_PIERCE_LINE_CM = 0.2
const XRAY_PIERCE_SQUARE_HALF_CM = 1.2
const XRAY_CALLOUT_POSITION = new vec3(-10, 1.7, 13.1)
/** The audit asks for 3x. The mesh is true size. The cages are tight around the pins, so the two boxes keep a clear gap at this scale. */
const XRAY_CALLOUT_SCALE = 3
const XRAY_CALLOUT_HALF_LONG = 0.65
const XRAY_CALLOUT_HALF_SHORT = 0.3
const XRAY_CALLOUT_HALF_Y = 0.1
const XRAY_CALLOUT_BAR_CM = 0.07
/** The wrong pins rest as a thin red outline, thinner than the right pins, so the right answer leads. The filled red is only the warning and the refusal. */
const XRAY_CALLOUT_RST_BAR_CM = 0.05
const XRAY_CALLOUT_RST_RING_WIDTH_CM = 0.05
const RST_CALLOUT_COLOR = new vec4(1, 0.239, 0.29, 1)
/** Safe #2EF2B8: the right pins at the fix. Amber stays on hidden parts. */
const SAFE_GREEN = new vec3(0.18, 0.949, 0.722)
const XRAY_CALLOUT_PIN_OFFSET_CM = 0.4
const XRAY_CALLOUT_PIN_RADIUS_CM = 0.2
const XRAY_CALLOUT_RING_WIDTH_CM = 0.07
/** The board art prints CLR_CMOS under the callout. This patch hides that text while the callout is on. */
const SILKSCREEN_MASK_CENTER = new vec3(-11.1, 0.35, 9.5)
const SILKSCREEN_MASK_SIZE = new vec2(4.8, 2.2)
/** After the Board, before the X-ray marks. */
const SILKSCREEN_MASK_RENDER_ORDER = 5
const GPU_XRAY_EDGE_ALPHA = 0.45
/** #7ADFFF, as a 20% fill on the GPU shell and the Glass until the scan. Each is opaque or additive, so the color carries the 20%. */
const SHELL_FILL_RGB = new vec3(0.0956, 0.175, 0.2)
const SHELL_FILL_FADE_SECONDS = 0.9
const CHASSIS_BAR_CM = 0.2
/** Local offset of the Jumper silkscreen while the callout is on: on the far side of the CLR_CMOS cage, clear of the GPU corner. */
const CALLOUT_LABEL_LOCAL = new vec3(-1.6, 0.8, -2.7)
/** The top of JumperVisual, above the part origin. */
const JUMPER_TOP_CM = 0.45
/** Half the spacing of the CLR_CMOS pins, which run along z on this board. */
const JUMPER_PIN_Z_CM = 0.38
const JUMPER_PIN_RADIUS_CM = 0.2
/** The next-step arrow stands this far right of the Jumper ring center, still inside the ring. */
const JUMPER_CUE_RIGHT_CM = 1
/** The Jumper ring reaches 0.75 cm past its collider, so the card must not catch a click on the ring. */
const JUMPER_RING_MARGIN_CM = 0.75
const CONTACT_APPROACH_SECONDS = 0.35
const CONTACT_RETRACT_SECONDS = 0.25
const SCREWDRIVER_TRAVEL_CM = 4
/** The tool leans up and right on screen, so it starts inside the board frame and stays clear of the callout and the Wait card. */
const SCREWDRIVER_DIRECTION = new vec3(0.75, 0.6365, 0.177).normalize()
const SCREWDRIVER_COLOR = new vec4(0.949, 0.984, 1, 1)
const PAD_FLASH_COLOR = new vec4(0.4196, 1, 0.6196, 1)
const CONTACT_RENDER_ORDER = 14
/** Rig-local x, z bends from the power cord to the CLR_CMOS pins at the near-left corner of the board. No decoy lies on this route. */
const RIBBON_BENDS: number[][] = [[-33, 2], [-25, 5], [-19, 7.5]]

// The working view looks at the board center 35 degrees below level, in rig-local axes.
const VIEW_FORWARD = new vec3(0, -0.5736, -0.8192)
const VIEW_UP = new vec3(0, 0.8192, -0.5736)
const RIG_VIEW_DEPTH_CM = 85
// The display band of the Specs preview, measured from a preview capture.
const DISPLAY_HALF_TAN_X = 0.21
const DISPLAY_HALF_TAN_Y = 0.24
const BAND_MARGIN_CM = 0.5
/** The one panel lane: this far up the view plane through the board center, above the board. */
const PANEL_LANE_UP_CM = 17.5
const WAIT_CARD_UP_CM = 13.9
/** The card sits left of center, so its lower right corner clears the memory sticks. */
const WAIT_CARD_X_CM = -5
/** A button or card fills the lane at some steps, so a refusal line there goes below the board. */
const BELOW_BOARD_UP_CM = -16
/** At the fix the primary instruction reads first, on the left, and the short fallback sits after it. */
const FIX_PRIMARY_LANE_X_CM = -8.5
const FIX_SECONDARY_LANE_X_CM = 8.5
const GPU_SILKSCREEN_QUIET_ALPHA = 0.3
/** The fallback line stays short. This caveat shows when the card is actually lifted. */
const GPU_CAVEAT_LINE = "Real card: screw, latch, power cables."
const SYMPTOM_LABEL_X_CM = 1.35
/** The open Monitor cage stays quiet at the working view until the first boot pays it off. */
const MONITOR_EDGE_QUIET_ALPHA = 0.3
/** recordingMode only. These lines do not point at a target, so they sit back on video. Tests run with recordingMode off. */
const RECORDING_CHASSIS_ALPHA = 0.2
const RECORDING_TABLE_EDGE_ALPHA = 0.12
const RECORDING_MONITOR_DONE_ALPHA = 0.6
/** The bright bar across the lower frame was the table edge. It stays only as a faint reference. */
const TABLE_EDGE_ALPHA = 0.22
const LED_HALO_RADIUS_CM = 3.5
const LED_HALO_WIDTH_CM = 0.3
const LED_HALO_LIFT_CM = 0.7
const LED_HALO_RENDER_ORDER = 13
/** Under the halo line, so the line reads over its own glow. */
const LED_GLOW_RENDER_ORDER = 12
const LED_GLOW_ALPHA = 0.45
const LED_HALO_MIN_ALPHA = 0.35
const LED_HALO_LOOP_SECONDS = 1.8
/** Plan L2: the amber line from the opening prompt below the board to the near rim of the halo. */
const LED_LEADER_LENGTH_CM = 6
const LED_LEADER_WIDTH_CM = 0.18
const EDGE_RAMP_SECONDS = 0.4
const EARLY_WARNING_DWELL_SECONDS = 0.35
const EARLY_WARNING_MIN_LINE_SECONDS = 0.6
const EARLY_WARNING_COOLDOWN_SECONDS = 2
/** A press this soon after the Glass lift is the late half of a double press. It is ignored, not refused. */
const GLASS_SECOND_PRESS_IGNORE_SECONDS = 1.2
/** A cursor counts as moved past half a degree, about 0.8 cm on the board at the working distance. Tuned for a mouse; real hand jitter is UNKNOWN. */
const LIFT_HOLD_MOVE_COS = Math.cos((0.5 * Math.PI) / 180)
const LIFT_HOLD_MOVE_CM = 0.5
const TRAINING_LABEL = "First boot may take minutes. Time-lapsed"
const TRAINING_HOLD_LINE = "Give memory training several minutes."
const DONE_LABEL = "Simulated recovery: POST successful."
/** Names the monitor result at the working view, because the monitor itself is above the frame. */
const DONE_MONITOR_LINE = "Monitor now shows the boot screen."
/** Three lines fit the 5.5 cm panel only below the opening size of 68. */
const DONE_TEXT_SIZE = 56
const DONE_NEXT_LINE = "Next: BIOS Setup, Load Optimized Defaults."
/** The final panel is the only green panel, so the ending reads as a result at the working view. */
const DONE_TEXT_COLOR = new vec4(0.42, 1, 0.62, 1)
/** The ring expands in the audit's 500 ms, then holds at full radius so it reads on video, then fades. */
const DONE_RING_EXPAND_SECONDS = 0.5
const DONE_RING_HOLD_SECONDS = 0.6
const DONE_RING_FADE_SECONDS = 0.4
const DONE_RING_START_RADIUS_CM = 1
const DONE_RING_END_RADIUS_CM = 9
/** The flat ring scales with its radius, so this width holds at the middle of the expansion. */
const DONE_RING_WIDTH_CM = 0.12
const DONE_RING_MID_RADIUS_CM = 5

interface XRayEntry {
  x: number
  material: Material
  color: vec4
  ignited: boolean
}

/** Per-box dwell state. A warning fires once per stay, and the box then cools down. */
interface EarlyWarningState {
  inBoxSince: number
  warned: boolean
  cooldownUntil: number
}

@component
export class ClearCmosMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClearCmosMain – repair flow</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Recording only. On: LeafIndex and LEAF Plugin Bridge are disabled at start, so no LEAF scenario or LEAF overlay can show, and the chassis cage, table edge, and idle Monitor frame are hidden or dimmed for video. Turn it off to run tests.")
  recordingMode: boolean = false

  @input
  @hint("Time-lapsed wait in seconds after the fix. LEAF scenarios set this to 1.")
  @widget(new SliderWidget(1, 30, 1))
  waitSeconds: number = 10

  @input
  @hint("Time-lapsed first-boot hold in seconds. LEAF scenarios set this to 3.")
  @widget(new SliderWidget(1, 30, 1))
  trainingSeconds: number = 6

  @input
  @hint("Seconds the screwdriver holds on the pins at the fix.")
  screwdriverHoldSeconds: number = 2

  @input
  @hint("Seconds the jumper pads flash on contact. The audit value is 0.15.")
  padFlashSeconds: number = 0.15

  @input
  @hint("Maximum distance in cm between the battery and the pad to accept a drop.")
  @widget(new SliderWidget(1, 8, 0.5))
  padAcceptCm: number = 3

  @input
  @hint("Minimum battery drag in cm from its marked edge.")
  @widget(new SliderWidget(1, 8, 0.5))
  minDragCm: number = 3

  @input
  @hint("Seconds the refusal line stays visible.")
  @widget(new SliderWidget(1, 10, 0.5))
  refusalSeconds: number = 2.5

  @input
  @hint("Distance in cm between the cursor and a no-go box at which the box starts to strengthen.")
  @widget(new SliderWidget(5, 40, 1))
  proximityCm: number = 20

  @input
  @hint("Refusal line used when a part has no refusal text of its own.")
  genericRefusal: string = "Follow the green ring first."

  @input
  @hint("Opening label beside the DRAM light, first line.")
  symptomLabelLine1: string = "DRAM light stuck on? Pinch it."

  @input
  @hint("Opening label beside the DRAM light, second line.")
  symptomLabelLine2: string = "If it just started, wait. Memory training can look like this."

  @input
  @hint("Step label: power cord.")
  cordLabel: string = "Unplug the power cord"
  @input
  @hint("Step label: glass.")
  glassLabel: string = "Lift the glass side panel"
  @input
  @hint("Label for the optional battery route: lift the graphics card.")
  gpuLabel: string = "Or lift graphics card"
  @input
  @hint("Step label: jumper.")
  jumperLabel: string = "Pinch CLR_CMOS pins"
  @input
  @hint("Step label: battery.")
  batteryLabel: string = "Drag battery to green pad"
  @input
  @hint("Step label: power button.")
  powerLabel: string = "Press the power button"
  @ui.group_end

  @ui.group_start("References")
  @input @hint("Camera object used to place the rig at the user's start.") cameraObject!: SceneObject
  @input @hint("Rig root.") rig!: SceneObject
  @input @hint("Transparent unlit material cloned for rings and outlines.") overlayMaterial!: Material

  @input @hint("DRAM LED.") dramLed!: SceneObject
  @input @hint("Monitor screen UI.") monitor!: ClearCmosMonitorUI
  @input @hint("X-ray group.") xRay!: SceneObject
  @input @hint("Arrow controller.") arrow!: ClearCmosArrow
  @input @hint("The arrow over the current next-step target.") nextCue!: ClearCmosNextCue
  @input @hint("Battery pad.") batteryPad!: SceneObject

  @input @hint("PowerCord.") powerCord!: ClearCmosPart
  @input @hint("Glass.") glass!: ClearCmosPart
  @input @hint("GPU.") gpu!: ClearCmosPart
  @input @hint("Jumper.") jumper!: ClearCmosPart
  @input @hint("RstJumper decoy: the RST pins beside CLR_CMOS.") rstJumper!: ClearCmosPart
  @input @hint("Battery.") battery!: ClearCmosPart
  @input @hint("BatteryRedPart decoy.") batteryRedPart!: ClearCmosPart
  @input @hint("Socket decoy.") socket!: ClearCmosPart
  @input @hint("MemoryStick decoy.") memoryStick!: ClearCmosPart
  @input @hint("PowerButton.") powerButton!: ClearCmosPart

  @input @hint("SymptomButton.") symptomButton!: ClearCmosActionButtonUI
  @input @hint("AnchorButton.") anchorButton!: ClearCmosActionButtonUI
  @input @hint("RebuildButton.") rebuildButton!: ClearCmosActionButtonUI
  @input @hint("SymptomLabel.") symptomLabel!: ClearCmosLabelUI
  @input @hint("SymptomNote: the caution sentence of the opening, in the top lane.") symptomNote!: ClearCmosLabelUI
  @input @hint("StepLabel.") stepLabel!: ClearCmosLabelUI
  @input @hint("StepLabel2, used only at the fix.") stepLabel2!: ClearCmosLabelUI
  @input @hint("RefusalLine.") refusalLine!: ClearCmosLabelUI
  @input @hint("WaitCard.") waitCard!: ClearCmosWaitCardUI
  @ui.group_end

  private step: Step = Step.Symptom
  private started = false
  private waitLeft = 0
  private refusalTimer: DelayedCallbackEvent
  private parts: ClearCmosPart[] = []
  private sfx = new Map<SfxName, AudioComponent>()
  /** Every sound played, in order. It grows only when a sound plays, and LEAF reads it. */
  private sfxLog: SfxName[] = []
  private ribbon: SceneObject
  private ribbonBuilder: MeshBuilder
  private ribbonPath: vec3[] = []
  private ribbonClock = -1
  private ribbonDrawn = 0
  private ledHalo: SceneObject
  private ledLeader: SceneObject
  private ledHaloMaterial: Material
  private ledHaloColor = new vec4(1, 0.757, 0.302, 1)
  private ledHaloClock = 0
  private ledGlowMaterial: Material
  private ledGlowColor = new vec4(1, 0.757, 0.302, 0)
  private doneRing: SceneObject
  private doneRingMaterial: Material
  private doneRingColor = new vec4(0.478, 0.875, 1, 1)
  private doneRingScale = new vec3(1, 1, 1)
  private monitorEdgeMaterial: Material
  private monitorEdgeColor: vec4
  private trainingLeft = 0
  private gpuEdgeMaterial: Material
  private gpuEdgeColor: vec4
  private shellFillMaterials: Material[] = []
  private shellFillColor = new vec4(0, 0, 0, 1)
  private xRayEntries: XRayEntry[] = []
  /** The CLR_CMOS cage and callout: amber like other hidden parts until the fix, then the safe green. */
  private xRaySafeEntries: XRayEntry[] = []
  private xRayScanBar: SceneObject
  private xRayScanPosition = new vec3(XRAY_SCAN_FROM_X_CM, XRAY_SCAN_Y_CM, XRAY_SCAN_Z_CM)
  private xRayPierce: SceneObject
  private jumperSilkscreen: SceneObject
  private jumperSilkscreenHome: vec3
  private screwdriver: SceneObject
  private rstSilkscreen: SceneObject
  private batterySilkscreen: SceneObject
  private gpuSilkscreenText: Text
  /** The small DRAM word beside the light, so the words near it match the opening line. */
  private dramTag: SceneObject
  private gpuSilkscreenColor: vec4
  private screwdriverPosition = new vec3(0, 0, 0)
  private contactPoint = new vec3(0, 0, 0)
  private padFlash: SceneObject
  private padFlashTimer: DelayedCallbackEvent
  /** True from the jumper pinch until the tool has left, so the X-ray stays on for the contact. */
  private contactPlaying = false
  private cancelContact: CancelFunction | null = null
  /** LEAF supplies a camera-to-part ray here, because its interactor has no cursor ray to aim. */
  private testRay: { start: vec3; direction: vec3 } | null = null
  private earlyWarnings = new Map<ClearCmosPart, EarlyWarningState>()
  /** The ray of each interactor when a covering part lifted. Until that ray moves, a part the lift uncovered does not start its dwell. */
  private liftHeldRays = new Map<Interactor, { start: vec3; direction: vec3 }>()
  private knownInteractors: Interactor[] = []
  private knownInteractorsRefreshAt = 0
  /** Refilled in place each frame, because SIK's getTargetingInteractors builds a new array per call. */
  private readonly targetingInteractors: Interactor[] = []
  /** Total early warnings played. LEAF reads this to prove a warning did not repeat. */
  private earlyWarningCount = 0
  private labelsHiddenByLine: ClearCmosLabelUI[] = []
  /** The battery route needs the GPU out of the way. The jumper route never asks for it. */
  private gpuLifted = false
  /** True once the fix was made by this part, so a repeat pinch on it is ignored and not refused. */
  private jumperPinched = false
  private batteryDropped = false
  /** The out-of-view chime plays once in a run, however often the cord leaves the view again. */
  private chimePlayed = false
  private glassLiftedAt = Number.NEGATIVE_INFINITY

  onAwake() {
    if (this.recordingMode) this.disableLeafForRecording()
    // Secondary text #A9D8E8, so the fallback line reads after the primary instruction.
    this.stepLabel2.textColor = new vec4(0.663, 0.847, 0.91, 1)
    this.parts = [
      this.powerCord, this.glass, this.gpu, this.jumper, this.rstJumper, this.battery,
      this.batteryRedPart, this.socket, this.memoryStick, this.powerButton,
    ]
    for (const p of this.parts) {
      p.configure(this.overlayMaterial)
      p.onPinched.add((part) => this.onPartPinched(part))
    }
    this.battery.onDragEnded.add(() => this.onBatteryDropped())
    this.battery.onDragStarted.add(() => this.onBatteryDragStarted())
    this.symptomButton.onPressed.add(() => this.onButton(Step.Symptom))
    this.anchorButton.onPressed.add(() => this.onButton(Step.Anchor))
    this.rebuildButton.onPressed.add(() => this.onButton(Step.Rebuild))
    this.refusalTimer = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.refusalTimer.bind(() => this.endRefusalLine())
    for (const name of Object.keys(SFX) as SfxName[]) this.sfx.set(name, this.makeAudio(name))
    // The brief's out-of-view chime. It plays once, the first time the arrow appears.
    this.arrow.onBecameOutOfView.add(() => this.onArrowOutOfView())
    this.buildRibbon()
    this.buildLedHalo()
    this.buildLedLeader()
    this.buildDoneRing()
    const kit = applyMeshKit(this.rig, this.overlayMaterial)
    this.buildChassisOutline(kit.edgeMaterial)
    this.buildGpuEdgeMaterial()
    this.buildQuietEdges()
    this.buildShellFills()
    this.buildXRayVisuals()
    this.buildContactVisuals()
    print("[ClearCmos] mesh kit added triangles=" + kit.addedTriangles)
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }



  private makeAudio(name: SfxName): AudioComponent {
    const a = this.sceneObject.createComponent("Component.AudioComponent") as AudioComponent
    a.audioTrack = SFX[name].track
    a.volume = SFX[name].volume
    a.playbackMode = Audio.PlaybackMode.LowLatency
    return a
  }

  private onArrowOutOfView(): void {
    print("[ClearCmos] arrow target out of view at step " + Step[this.step])
    if (this.chimePlayed) return
    this.chimePlayed = true
    this.playSfx("chime")
  }

  /** Called only on an event, never per frame. The log line is the proof that the sound played at its moment. */
  private playSfx(name: SfxName): void {
    const audio = this.sfx.get(name)
    audio.play(1)
    this.sfxLog.push(name)
    print("[ClearCmos] sfx " + name + " at step " + Step[this.step] + " playing=" + audio.isPlaying())
  }

  /** ClearCmos sits above both objects in the hierarchy, so they are disabled before their own scripts start. */
  private disableLeafForRecording(): void {
    for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
      const root = global.scene.getRootObject(i)
      if (root.name === "LeafIndex" || root.name === "LEAF Plugin Bridge") {
        root.enabled = false
        print("[ClearCmos] recordingMode: disabled " + root.name)
      }
    }
  }

  private tick(): void {
    if (!this.started) {
      this.started = true
      // NextCueArrow sits below this script in the hierarchy, so it is awake only from the first tick.
      this.nextCue.configure(this.overlayMaterial, this.cameraObject)
      this.placeRig()
      this.monitor.showNoSignal()
      this.setStep(Step.Symptom)
      print("[ClearCmos] started, step=" + Step[this.step])
      return
    }
    if (this.step === Step.Wait) {
      this.waitLeft -= getDeltaTime()
      this.waitCard.setRemaining(this.waitLeft)
      if (this.waitLeft <= 0) this.setStep(Step.Rebuild)
    }
    if (this.step === Step.Training) {
      this.trainingLeft -= getDeltaTime()
      if (this.trainingLeft <= 0) this.setStep(Step.Done)
    }
    this.updateTargetingInteractors()
    this.updateNoGoProximity()
    this.updateMemoryPriority()
    this.updateRibbon()
    this.updateLedHalo()
    this.nextCue.setSuppressed(this.arrow.targetOutOfView)
  }

  /** The opening pulse. It reuses one color, so it allocates nothing per frame. */
  private updateLedHalo(): void {
    if (this.step !== Step.Symptom) return
    this.ledHaloClock = (this.ledHaloClock + getDeltaTime()) % LED_HALO_LOOP_SECONDS
    const pulse = 0.5 - 0.5 * Math.cos((2 * Math.PI * this.ledHaloClock) / LED_HALO_LOOP_SECONDS)
    this.ledHaloColor.a = LED_HALO_MIN_ALPHA + (1 - LED_HALO_MIN_ALPHA) * pulse
    this.ledHaloMaterial.mainPass.baseColor = this.ledHaloColor
    this.ledGlowColor.a = LED_GLOW_ALPHA * this.ledHaloColor.a
    this.ledGlowMaterial.mainPass.baseColor = this.ledGlowColor
  }

  private buildLedHalo(): void {
    this.ledHaloMaterial = this.overlayMaterial.clone()
    this.ledHaloMaterial.mainPass.depthWrite = false
    this.ledHaloMaterial.mainPass.depthTest = false
    this.ledHaloMaterial.mainPass.twoSided = true
    this.ledHalo = global.scene.createSceneObject("LedHalo")
    this.ledHalo.setParent(this.rig)
    const led = this.dramLed.getTransform().getLocalPosition()
    this.ledHalo.getTransform().setLocalPosition(led.add(new vec3(0, LED_HALO_LIFT_CM, 0)))
    this.ledHalo.getTransform().setLocalScale(vec3.one().uniformScale(LED_HALO_RADIUS_CM))
    const visual = this.ledHalo.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = buildThinRing(1 - LED_HALO_WIDTH_CM / LED_HALO_RADIUS_CM)
    visual.mainMaterial = this.ledHaloMaterial
    visual.setRenderOrder(LED_HALO_RENDER_ORDER)
    // A disc under the halo, so the light reads as the thing to pinch. Its parent scale makes it the halo radius.
    this.ledGlowMaterial = this.overlayMaterial.clone()
    this.ledGlowMaterial.mainPass.depthWrite = false
    this.ledGlowMaterial.mainPass.depthTest = false
    this.ledGlowMaterial.mainPass.twoSided = true
    this.ledGlowMaterial.mainPass.baseColor = this.ledGlowColor
    const glow = global.scene.createSceneObject("LedGlow")
    glow.setParent(this.ledHalo)
    const glowVisual = glow.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    glowVisual.mesh = buildThinRing(0)
    glowVisual.mainMaterial = this.ledGlowMaterial
    glowVisual.setRenderOrder(LED_GLOW_RENDER_ORDER)
    this.ledHalo.enabled = false
  }

  /**
   * Plan L2: links the opening prompt to the light. It ends on the near rim of the halo and starts on the eye ray
   * through the top edge of the prompt panel, so it reads as one line from the panel to the halo at the working view.
   */
  private buildLedLeader(): void {
    const led = this.dramLed.getTransform().getLocalPosition()
    const end = new vec3(led.x, led.y + LED_HALO_LIFT_CM, led.z + LED_HALO_RADIUS_CM)
    const panelTop = new vec3(end.x, 0, 0).add(VIEW_UP.uniformScale(BELOW_BOARD_UP_CM + this.symptomLabel.heightCm / 2))
    const eye = VIEW_FORWARD.uniformScale(-RIG_VIEW_DEPTH_CM)
    const ray = panelTop.sub(eye)
    const toEnd = end.sub(eye)
    const a = ray.dot(ray)
    const b = ray.dot(toEnd)
    const c = toEnd.dot(toEnd) - LED_LEADER_LENGTH_CM * LED_LEADER_LENGTH_CM
    const start = eye.add(ray.uniformScale((b + Math.sqrt(Math.max(0, b * b - a * c))) / a))
    const material = this.overlayMaterial.clone()
    material.mainPass.depthWrite = false
    material.mainPass.depthTest = false
    material.mainPass.twoSided = true
    material.mainPass.baseColor = XRAY_COLOR
    this.ledLeader = global.scene.createSceneObject("LedLeader")
    // Under the Rig, not under LedHalo, which is scaled.
    this.ledLeader.setParent(this.rig)
    const visual = this.ledLeader.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = buildLeader(start, end, LED_LEADER_WIDTH_CM / 2, VIEW_FORWARD.uniformScale(-1))
    visual.mainMaterial = material
    visual.setRenderOrder(LED_HALO_RENDER_ORDER)
    this.ledLeader.enabled = false
  }

  /** The ending: one ring from the DRAM light as it goes out. */
  private buildDoneRing(): void {
    this.doneRingMaterial = this.overlayMaterial.clone()
    this.doneRingMaterial.mainPass.depthWrite = false
    this.doneRingMaterial.mainPass.depthTest = false
    this.doneRingMaterial.mainPass.twoSided = true
    this.doneRing = global.scene.createSceneObject("DoneRing")
    this.doneRing.setParent(this.rig)
    const led = this.dramLed.getTransform().getLocalPosition()
    this.doneRing.getTransform().setLocalPosition(led.add(new vec3(0, LED_HALO_LIFT_CM, 0)))
    const visual = this.doneRing.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = buildThinRing(1 - DONE_RING_WIDTH_CM / DONE_RING_MID_RADIUS_CM)
    visual.mainMaterial = this.doneRingMaterial
    visual.setRenderOrder(LED_HALO_RENDER_ORDER)
    this.doneRing.enabled = false
  }

  /** Reuses one color and one scale, so the expansion allocates nothing per frame. */
  private playDoneRing(): void {
    this.doneRing.enabled = true
    const transform = this.doneRing.getTransform()
    animate({
      duration: DONE_RING_EXPAND_SECONDS + DONE_RING_HOLD_SECONDS + DONE_RING_FADE_SECONDS,
      easing: "linear",
      update: (a) => {
        const t = a * (DONE_RING_EXPAND_SECONDS + DONE_RING_HOLD_SECONDS + DONE_RING_FADE_SECONDS)
        const expand = 1 - Math.pow(1 - Math.min(1, t / DONE_RING_EXPAND_SECONDS), 3)
        const r = DONE_RING_START_RADIUS_CM + (DONE_RING_END_RADIUS_CM - DONE_RING_START_RADIUS_CM) * expand
        this.doneRingScale.x = r
        this.doneRingScale.y = r
        this.doneRingScale.z = r
        transform.setLocalScale(this.doneRingScale)
        this.doneRingColor.a = 1 - Math.max(0, (t - DONE_RING_EXPAND_SECONDS - DONE_RING_HOLD_SECONDS) / DONE_RING_FADE_SECONDS)
        this.doneRingMaterial.mainPass.baseColor = this.doneRingColor
      },
      ended: () => {
        this.doneRing.enabled = false
      },
    })
  }

  /** A cage from the CaseTray bottom to the Glass top, so the PC reads as one chassis. */
  private buildChassisOutline(edgeMaterial: Material): void {
    const tray = this.rig.children.find((c) => c.name === "CaseTray").getTransform()
    const trayScale = tray.getLocalScale()
    const trayPosition = tray.getLocalPosition()
    const bottom = trayPosition.y - trayScale.y / 2
    const top = this.glass.getTransform().getLocalPosition().y + 0.2
    const size = new vec3(trayScale.x, top - bottom, trayScale.z)
    const chassis = global.scene.createSceneObject("ChassisOutline")
    chassis.setParent(this.rig)
    chassis.getTransform().setLocalPosition(new vec3(trayPosition.x, (top + bottom) / 2, trayPosition.z))
    chassis.getTransform().setLocalScale(size)
    const visual = chassis.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = buildCage(size, CHASSIS_BAR_CM)
    visual.mainMaterial = edgeMaterial
    if (this.recordingMode) {
      // A full-width cage line crosses the "Graphics card" label on video. A dimmed copy leaves the shared edge color unchanged.
      const dimmed = edgeMaterial.clone()
      const color = dimmed.mainPass.baseColor
      color.a = RECORDING_CHASSIS_ALPHA
      dimmed.mainPass.baseColor = color
      visual.mainMaterial = dimmed
    }
  }

  /** The GPU shell and the Glass each get their own material, so the 20% fill can fade at the scan without touching the shared asset. */
  private buildShellFills(): void {
    const gpuVisual = this.gpu.getSceneObject().children.find((c) => c.name === "GpuVisual")
    const glassVisual = this.glass.getSceneObject().children.find((c) => c.name === "GlassVisual")
    for (const owner of [gpuVisual, glassVisual]) {
      const visual = owner.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      const material = visual.mainMaterial.clone()
      visual.mainMaterial = material
      this.shellFillMaterials.push(material)
    }
    this.setShellFill(1)
  }

  /** level 1 is the 20% fill, level 0 is no fill. It reuses one color, so the fade allocates nothing per frame. */
  private setShellFill(level: number): void {
    this.shellFillColor.r = SHELL_FILL_RGB.x * level
    this.shellFillColor.g = SHELL_FILL_RGB.y * level
    this.shellFillColor.b = SHELL_FILL_RGB.z * level
    for (const material of this.shellFillMaterials) material.mainPass.baseColor = this.shellFillColor
  }

  private setGpuEdgeAlpha(alpha: number): void {
    this.gpuEdgeColor.a = alpha
    this.gpuEdgeMaterial.mainPass.baseColor = this.gpuEdgeColor
  }

  /** The Table and Monitor lines stop reading as stray bars. Each gets its own material so the shared edge color stays full elsewhere. */
  private buildQuietEdges(): void {
    const tableEdges = findEdgeLines(this.rig, "Table")
    const tableMaterial = tableEdges.mainMaterial.clone()
    const tableColor = tableMaterial.mainPass.baseColor
    tableColor.a = this.recordingMode ? RECORDING_TABLE_EDGE_ALPHA : TABLE_EDGE_ALPHA
    tableMaterial.mainPass.baseColor = tableColor
    tableEdges.mainMaterial = tableMaterial

    const monitorEdges = findEdgeLines(this.rig, "MonitorBody")
    this.monitorEdgeMaterial = monitorEdges.mainMaterial.clone()
    this.monitorEdgeColor = this.monitorEdgeMaterial.mainPass.baseColor
    monitorEdges.mainMaterial = this.monitorEdgeMaterial
    this.setMonitorEdgeAlpha(this.monitorEdgeAlphaFor(Step.Symptom))
  }

  /** With recordingMode on, the Monitor frame stays hidden until the boot screen fills it, so it never reads as an empty panel. */
  private monitorEdgeAlphaFor(step: Step): number {
    if (this.recordingMode) return step >= Step.Done ? RECORDING_MONITOR_DONE_ALPHA : 0
    return step >= Step.Training ? 1 : MONITOR_EDGE_QUIET_ALPHA
  }

  private setMonitorEdgeAlpha(alpha: number): void {
    this.monitorEdgeColor.a = alpha
    this.monitorEdgeMaterial.mainPass.baseColor = this.monitorEdgeColor
  }

  /** The GPU edges get their own material, so the X-ray can dim them alone. */
  private buildGpuEdgeMaterial(): void {
    const gpuVisual = this.gpu.getSceneObject().children.find((c) => c.name === "GpuVisual")
    const edges = gpuVisual.children.find((c) => c.name === "EdgeLines")
    const visual = edges.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.gpuEdgeMaterial = visual.mainMaterial.clone()
    this.gpuEdgeColor = this.gpuEdgeMaterial.mainPass.baseColor
    visual.mainMaterial = this.gpuEdgeMaterial
  }

  /** Replaces the two X-ray solids with outlines, and adds the sweep bar, pierce lines, and the 3x callout. */
  private buildXRayVisuals(): void {
    const source = (this.xRay.getChild(0).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial
    const jumper = this.xRay.children.find((c) => c.name === "XRayJumper")
    const battery = this.xRay.children.find((c) => c.name === "XRayBattery")
    this.adoptXRayVisual(jumper, source, buildCage(XRAY_JUMPER_SCALE, XRAY_JUMPER_BAR_CM), this.jumper.getTransform().getLocalPosition().x)
    this.xRaySafeEntries.push(this.xRayEntries[this.xRayEntries.length - 1])
    this.adoptXRayVisual(battery, source, buildThinRing(XRAY_BATTERY_RING_INNER), this.battery.getTransform().getLocalPosition().x)
    battery.getTransform().setLocalScale(XRAY_BATTERY_SCALE)

    // Only the battery is under the GPU now, so only the battery has a pierce line.
    const batteryX = this.battery.getTransform().getLocalPosition().x
    this.xRayPierce = this.makeXRayChild("XRayPierce", source, buildPierce(
      [new vec2(batteryX, this.battery.getTransform().getLocalPosition().z)],
      XRAY_PIERCE_TOP_CM, XRAY_PIERCE_BOTTOM_CM, XRAY_PIERCE_LINE_CM, XRAY_PIERCE_SQUARE_HALF_CM,
    ), batteryX)

    const jumperPair = this.calloutPairCenter(this.jumper)
    const rstPair = this.calloutPairCenter(this.rstJumper)
    // The CLR_CMOS pins lead at the fix in the safe green. The RST pins are the wrong reach, so they rest as a thin red outline.
    const callout = this.makeXRayChild("XRayCallout", source, buildPinPairCallout(
      [{ x: jumperPair.x, z: jumperPair.y, pinsAlongX: false }],
      XRAY_CALLOUT_HALF_LONG, XRAY_CALLOUT_HALF_SHORT, XRAY_CALLOUT_HALF_Y,
      XRAY_CALLOUT_BAR_CM, XRAY_CALLOUT_PIN_OFFSET_CM, XRAY_CALLOUT_PIN_RADIUS_CM, XRAY_CALLOUT_RING_WIDTH_CM,
    ), this.jumper.getTransform().getLocalPosition().x)
    this.xRaySafeEntries.push(this.xRayEntries[this.xRayEntries.length - 1])
    const rstCallout = this.makeXRayChild("XRayCalloutRst", source, buildPinPairCallout(
      [{ x: rstPair.x, z: rstPair.y, pinsAlongX: true }],
      XRAY_CALLOUT_HALF_LONG, XRAY_CALLOUT_HALF_SHORT, XRAY_CALLOUT_HALF_Y,
      XRAY_CALLOUT_RST_BAR_CM, XRAY_CALLOUT_PIN_OFFSET_CM, XRAY_CALLOUT_PIN_RADIUS_CM, XRAY_CALLOUT_RST_RING_WIDTH_CM,
    ), this.rstJumper.getTransform().getLocalPosition().x, RST_CALLOUT_COLOR)
    for (const object of [callout, rstCallout]) {
      object.getTransform().setLocalPosition(XRAY_CALLOUT_POSITION)
      object.getTransform().setLocalScale(vec3.one().uniformScale(XRAY_CALLOUT_SCALE))
    }
    this.buildSilkscreenMask()

    this.xRayScanBar = this.makeXRayChild("XRayScanBar", source, buildFlatBar(XRAY_SCAN_WIDTH_CM, XRAY_SCAN_LENGTH_CM), XRAY_SCAN_FROM_X_CM)
    this.xRayScanBar.getTransform().setLocalPosition(this.xRayScanPosition)
    this.xRayScanBar.enabled = false
  }

  /** Black reads as nothing on the additive display, so this removes the art text and leaves the callout label as the only CLR_CMOS. */
  private buildSilkscreenMask(): void {
    const mask = global.scene.createSceneObject("SilkscreenMask")
    mask.setParent(this.xRay)
    mask.getTransform().setLocalPosition(SILKSCREEN_MASK_CENTER)
    const material = this.overlayMaterial.clone()
    material.mainPass.depthWrite = false
    material.mainPass.baseColor = new vec4(0, 0, 0, 1)
    const visual = mask.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = buildFlatBar(SILKSCREEN_MASK_SIZE.x, SILKSCREEN_MASK_SIZE.y)
    visual.mainMaterial = material
    visual.setRenderOrder(SILKSCREEN_MASK_RENDER_ORDER)
  }

  /** Where a part's pin pair sits in the callout mesh: its target position, in true size, relative to the callout center. */
  private calloutPairCenter(part: ClearCmosPart): vec2 {
    const home = part.getTransform().getLocalPosition()
    const offset = part.targetOffset
    return new vec2(
      (home.x + offset.x - XRAY_CALLOUT_POSITION.x) / XRAY_CALLOUT_SCALE,
      (home.z + offset.z - XRAY_CALLOUT_POSITION.z) / XRAY_CALLOUT_SCALE,
    )
  }

  /** The bar is lit from its first frame. Others stay dark until the sweep crosses them. */
  private makeXRayChild(name: string, source: Material, mesh: RenderMesh, igniteX: number, tint: vec4 = XRAY_COLOR): SceneObject {
    const object = global.scene.createSceneObject(name)
    object.setParent(this.xRay)
    const material = this.adoptMaterial(source, name === "XRayScanBar", tint)
    const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = mesh
    visual.mainMaterial = material
    visual.setRenderOrder(XRAY_RENDER_ORDER)
    if (name !== "XRayScanBar") this.xRayEntries.push({ x: igniteX, material, color: new vec4(tint.r, tint.g, tint.b, 0), ignited: false })
    return object
  }

  private adoptXRayVisual(object: SceneObject, source: Material, mesh: RenderMesh, igniteX: number): void {
    const material = this.adoptMaterial(source, false)
    const visual = object.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = mesh
    visual.mainMaterial = material
    visual.setRenderOrder(XRAY_RENDER_ORDER)
    this.xRayEntries.push({ x: igniteX, material, color: new vec4(XRAY_COLOR.r, XRAY_COLOR.g, XRAY_COLOR.b, 0), ignited: false })
  }

  private adoptMaterial(source: Material, lit: boolean, tint: vec4 = XRAY_COLOR): Material {
    const material = source.clone()
    material.mainPass.depthTest = false
    material.mainPass.depthWrite = false
    material.mainPass.twoSided = true
    material.mainPass.baseColor = new vec4(tint.r, tint.g, tint.b, lit ? XRAY_COLOR.a : 0)
    return material
  }

  /** The memory and, at the fix, the jumper sit under other colliders, so a ray that aims at one passes through them. */
  private updateMemoryPriority(): void {
    if (this.step < Step.PowerCord || this.step > Step.Fix) return
    const memoryAimed = this.rayAimsAt(this.memoryStick)
    const jumperAimed = this.step === Step.Fix && !this.gpuLifted && this.rayAimsAt(this.jumper, JUMPER_RING_MARGIN_CM)
    this.glass.setColliderEnabled(!memoryAimed)
    this.gpu.setColliderEnabled(!memoryAimed && !jumperAimed)
  }

  private rayAimsAt(target: ClearCmosPart, marginCm: number = 0): boolean {
    if (this.testRay && target.rayHitsCollider(this.testRay.start, this.testRay.direction, marginCm)) return true
    for (let i = 0; i < this.targetingInteractors.length; i++) {
      const interactor = this.targetingInteractors[i]
      const start = interactor.startPoint
      const direction = interactor.direction
      if (start && direction && target.rayHitsCollider(start, direction, marginCm)) return true
    }
    return false
  }

  /** updateNoGoProximity and rayAimsAt share this list. Between refreshes it allocates nothing. */
  private updateTargetingInteractors(): void {
    if (this.step < Step.PowerCord || this.step > Step.Fix) return
    const now = getTime()
    if (now >= this.knownInteractorsRefreshAt) {
      this.knownInteractors = InteractionManager.getInstance().getInteractorsByType(InteractorInputType.All)
      this.knownInteractorsRefreshAt = now + INTERACTOR_LIST_REFRESH_SECONDS
    }
    this.targetingInteractors.length = 0
    for (let i = 0; i < this.knownInteractors.length; i++) {
      const interactor = this.knownInteractors[i]
      if (!isNull(interactor) && interactor.isTargeting()) this.targetingInteractors.push(interactor)
    }
  }

  /** Builds the full strip now. The reveal only appends indices, so each frame is cheap. */
  private buildRibbon(): void {
    this.ribbonPath = this.computeRibbonPath()
    const builder = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3 },
      { name: "texture0", components: 2 },
    ])
    builder.topology = MeshTopology.Triangles
    builder.indexType = MeshIndexType.UInt16
    for (let i = 0; i < this.ribbonPath.length; i++) {
      const p = this.ribbonPath[i]
      const before = this.ribbonPath[Math.max(0, i - 1)]
      const after = this.ribbonPath[Math.min(this.ribbonPath.length - 1, i + 1)]
      const along = after.sub(before).normalize()
      const side = new vec3(-along.z, 0, along.x).uniformScale(RIBBON_HALF_WIDTH_CM)
      const left = p.sub(side)
      const right = p.add(side)
      const v = i / (this.ribbonPath.length - 1)
      builder.appendVerticesInterleaved([left.x, left.y, left.z, 0, 1, 0, 0, v, right.x, right.y, right.z, 0, 1, 0, 1, v])
    }
    builder.updateMesh()
    this.ribbonBuilder = builder

    const material = this.overlayMaterial.clone()
    material.mainPass.depthWrite = false
    material.mainPass.depthTest = false
    material.mainPass.twoSided = true
    material.mainPass.baseColor = RIBBON_COLOR
    this.ribbon = global.scene.createSceneObject("SafePathRibbon")
    this.ribbon.setParent(this.rig)
    const visual = this.ribbon.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = builder.getMesh()
    visual.mainMaterial = material
    visual.setRenderOrder(RIBBON_RENDER_ORDER)
    this.ribbon.enabled = false
  }

  /** A Catmull-Rom curve from PowerCord to Jumper through RIBBON_BENDS, in rig-local cm. */
  private computeRibbonPath(): vec3[] {
    const from = this.powerCord.getTransform().getLocalPosition()
    const to = this.jumper.getTransform().getLocalPosition()
    const key = [new vec3(from.x, RIBBON_Y_CM, from.z)]
    for (const bend of RIBBON_BENDS) key.push(new vec3(bend[0], RIBBON_Y_CM, bend[1]))
    key.push(new vec3(to.x, RIBBON_Y_CM, to.z))
    const path: vec3[] = []
    for (let i = 0; i <= RIBBON_SEGMENTS; i++) {
      const position = (i / RIBBON_SEGMENTS) * (key.length - 1)
      const span = Math.min(key.length - 2, Math.floor(position))
      const t = position - span
      const p0 = key[Math.max(0, span - 1)]
      const p1 = key[span]
      const p2 = key[span + 1]
      const p3 = key[Math.min(key.length - 1, span + 2)]
      const a = p1.uniformScale(2)
      const b = p2.sub(p0).uniformScale(t)
      const c = p0.uniformScale(2).sub(p1.uniformScale(5)).add(p2.uniformScale(4)).sub(p3).uniformScale(t * t)
      const d = p1.uniformScale(3).sub(p0).sub(p2.uniformScale(3)).add(p3).uniformScale(t * t * t)
      path.push(a.add(b).add(c).add(d).uniformScale(0.5))
    }
    return path
  }

  private updateRibbon(): void {
    if (this.ribbonClock < 0 || this.ribbonDrawn >= RIBBON_SEGMENTS) return
    this.ribbonClock += getDeltaTime()
    const p = Math.min(1, this.ribbonClock / RIBBON_SECONDS)
    const eased = 0.5 - 0.5 * Math.cos(Math.PI * p)
    const wanted = p >= 1 ? RIBBON_SEGMENTS : Math.floor(eased * RIBBON_SEGMENTS)
    if (wanted <= this.ribbonDrawn) return
    const indices: number[] = []
    for (let i = this.ribbonDrawn; i < wanted; i++) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    this.ribbonBuilder.appendIndices(indices)
    this.ribbonBuilder.updateMesh()
    this.ribbonDrawn = wanted
  }

  /** 0 before the ribbon starts, 1 when it reaches the Jumper. */
  get ribbonProgress(): number {
    return this.ribbonDrawn / RIBBON_SEGMENTS
  }

  /** Width of the drawn strip, for the check against the punch-list ceiling. */
  get ribbonWidthCm(): number {
    return RIBBON_HALF_WIDTH_CM * 2
  }

  /** Rig-local points of the whole route, for checks against the no-go boxes. */
  get ribbonRoute(): vec3[] {
    return this.ribbonPath
  }

  /** The cursor ray is the preview stand-in for real hand distance. */
  private updateNoGoProximity(): void {
    if (this.step < Step.PowerCord || this.step > Step.Fix) return
    const interactors = this.targetingInteractors
    const now = getTime()
    for (const part of this.parts) {
      if (!part.isNoGoArmed) continue
      let best = 0
      let inBox = false
      const center = part.targetWorldPosition
      for (let i = 0; i < interactors.length; i++) {
        const interactor = interactors[i]
        const start = interactor.startPoint
        const direction = interactor.direction
        let distance = this.rayDistance(center, start, direction) - part.noGoRadiusCm
        const target = interactor.currentInteractable
        const isTarget = !!target && target.getSceneObject() === part.getSceneObject()
        if (isTarget) distance = 0
        best = Math.max(best, 1 - Math.max(0, distance) / this.proximityCm)
        const noPinch = interactor.currentTrigger === InteractorTriggerType.None
        // A cursor on another part (the Glass or the card) aims at that part, so a box under it does not count.
        const entersBox = isTarget || (!target && !!start && !!direction && part.rayHitsCollider(start, direction))
        const heldSinceLift = !!start && !!direction && this.isRayHeldSinceLift(interactor, start, direction)
        if (distance <= 0 && noPinch && entersBox && !heldSinceLift) inBox = true
      }
      // LEAF has no cursor ray to aim, so its test ray exercises the distance path.
      if (this.testRay) {
        const distance = this.rayDistance(center, this.testRay.start, this.testRay.direction) - part.noGoRadiusCm
        best = Math.max(best, 1 - Math.max(0, distance) / this.proximityCm)
      }
      part.setNoGoProximity(best)
      this.updateEarlyWarning(part, inBox, now)
    }
  }

  /** "It warns before your hand gets there": a wall rises at the part and a short line shows after a 350 ms dwell, with no pinch and no step change. */
  private updateEarlyWarning(part: ClearCmosPart, inBox: boolean, now: number): void {
    const state = this.earlyWarningState(part)
    if (!inBox) {
      state.inBoxSince = -1
      state.warned = false
      return
    }
    if (state.inBoxSince < 0) state.inBoxSince = now
    if (state.warned || now < state.cooldownUntil || now - state.inBoxSince < EARLY_WARNING_DWELL_SECONDS) return
    this.startEarlyWarningCooldown(part, now)
    this.earlyWarningCount++
    this.showRefusalLine(part, Math.max(EARLY_WARNING_MIN_LINE_SECONDS, this.refusalSeconds), this.earlyWarningLine(part))
    part.playWarningFlash(EARLY_WARNING_MIN_LINE_SECONDS)
    this.playSfx("warning_tick")
    print("[ClearCmos] early warning " + part.getSceneObject().name + " at step " + Step[this.step])
  }

  /** A part that a lift uncovered must not warn a cursor that never moved, so each targeting ray is frozen until it moves. */
  private holdDwellUntilRayMoves(): void {
    for (const interactor of InteractionManager.getInstance().getTargetingInteractors()) {
      const start = interactor.startPoint
      const direction = interactor.direction
      if (start && direction) this.liftHeldRays.set(interactor, { start, direction })
    }
  }

  /** True while this interactor's ray has stayed where it was when the cover lifted. The first move releases it for good. */
  private isRayHeldSinceLift(interactor: Interactor, start: vec3, direction: vec3): boolean {
    const held = this.liftHeldRays.get(interactor)
    if (!held) return false
    if (start.distance(held.start) <= LIFT_HOLD_MOVE_CM && direction.dot(held.direction) >= LIFT_HOLD_MOVE_COS) return true
    this.liftHeldRays.delete(interactor)
    return false
  }

  private earlyWarningState(part: ClearCmosPart): EarlyWarningState {
    let state = this.earlyWarnings.get(part)
    if (!state) {
      state = { inBoxSince: -1, warned: false, cooldownUntil: 0 }
      this.earlyWarnings.set(part, state)
    }
    return state
  }

  private startEarlyWarningCooldown(part: ClearCmosPart, now: number): void {
    const state = this.earlyWarningState(part)
    state.warned = true
    state.cooldownUntil = now + EARLY_WARNING_COOLDOWN_SECONDS
  }

  private rayDistance(point: vec3, start: vec3 | null, direction: vec3 | null): number {
    if (!start || !direction) return Number.POSITIVE_INFINITY
    const toPoint = point.sub(start)
    const along = Math.max(0, toPoint.dot(direction))
    return toPoint.sub(direction.uniformScale(along)).length
  }

  private placeRig(): void {
    const cam = this.cameraObject.getTransform()
    const authored = this.rig.getTransform().getLocalPosition()
    const backward = cam.forward
    const yaw = Math.atan2(backward.x, backward.z)
    const rotation = quat.fromEulerAngles(0, yaw, 0)
    const t = this.rig.getTransform()
    t.setWorldPosition(cam.getWorldPosition().add(rotation.multiplyVec3(authored)))
    t.setWorldRotation(rotation)
  }

  private onButton(from: Step): void {
    if (this.step !== from) return
    if (from === Step.Symptom) this.completeStep(Step.Anchor)
    // The scan answers this pinch with its own sounds, in setStep and igniteXRay.
    else if (from === Step.Anchor) this.setStep(Step.PowerCord)
    else if (from === Step.Rebuild) {
      this.glass.returnHome()
      this.gpu.returnHome()
      this.powerCord.returnHome()
      this.battery.returnHome()
      this.gpuLifted = false
      this.completeStep(Step.PowerOn)
    }
  }

  /** A step the user finished: the confirm sound, then the next step. */
  private completeStep(next: Step): void {
    this.playSfx("step_confirm")
    this.setStep(next)
  }

  /** A part already used is done. A second pinch on it, or the trigger end of the pinch that finished it, is ignored and never refused (B1, B2). */
  private isAlreadyDone(part: ClearCmosPart): boolean {
    if (this.step > Step.Rebuild) return false
    if (part === this.powerCord) return this.step > Step.PowerCord
    if (part === this.glass) return this.step > Step.Glass
    if (this.step < Step.Wait) return false
    return (part === this.jumper && this.jumperPinched) || (part === this.battery && this.batteryDropped) || (part === this.gpu && this.gpuLifted)
  }

  private onPartPinched(part: ClearCmosPart): void {
    // A part in flight is never refused, because the refusal shake would pin it in mid-air.
    if (part.isMoving || this.isAlreadyDone(part)) return
    if (this.step === Step.Fix && getTime() - this.glassLiftedAt < GLASS_SECOND_PRESS_IGNORE_SECONDS) return
    if (this.step === Step.PowerCord && part === this.powerCord) return this.advanceMoving(part, Step.Glass)
    if (this.step === Step.Glass && part === this.glass) return this.advanceMoving(part, Step.Fix)
    if (this.step === Step.Fix && part === this.gpu) {
      // A double press on the Glass lands on the card under it. It counts only once the Glass has finished lifting.
      if (!this.gpuLifted && !this.glass.isMoving) this.openBatteryRoute()
      return
    }
    if (this.step === Step.Fix && part === this.jumper) return this.finishFix(true)
    if (this.step === Step.Fix && part === this.battery && this.gpuLifted) return // The drop handler decides.
    if (this.step === Step.PowerOn && part === this.powerButton) return this.completeStep(Step.Training)
    if (this.step === Step.Training) {
      // A calm note. No red box, buzz, or shudder, because nothing is wrong.
      if (part === this.powerButton) this.showRefusalLine(part, this.refusalSeconds, TRAINING_HOLD_LINE)
      return
    }
    if (this.step === Step.Done) return
    this.refuse(part)
  }

  /** The battery fallback: the GPU lifts away, then the battery gets the second ring and its pad. */
  private openBatteryRoute(): void {
    this.gpuLifted = true
    this.holdDwellUntilRayMoves()
    this.playSfx("step_confirm")
    this.gpu.moveAway()
    this.gpu.hoverKind = "none"
    this.xRayPierce.enabled = false
    this.battery.setDragAllowed(true)
    this.batteryPad.enabled = true
    this.markNext(this.battery, this.batteryLabel, this.stepLabel2, FIX_SECONDARY_LANE_X_CM)
    this.cueAtPart(this.battery)
    // The caveat from the brief shows when the card actually lifts, on the panel below the board.
    this.symptomNote.placeAt(this.panelLane(0, this.symptomNote.widthCm, this.symptomNote.heightCm, BELOW_BOARD_UP_CM))
    this.symptomNote.show(GPU_CAVEAT_LINE, 0)
  }

  private advanceMoving(part: ClearCmosPart, next: Step): void {
    if (part === this.glass) {
      this.holdDwellUntilRayMoves()
      this.glassLiftedAt = getTime()
    }
    part.moveAway()
    this.completeStep(next)
  }

  private onBatteryDropped(): void {
    if (this.step !== Step.Fix) return
    const pos = this.battery.worldPosition
    const pad = this.batteryPad.getTransform().getWorldPosition()
    const moved = pos.distance(this.battery.homeWorldPosition)
    if (moved >= this.minDragCm && pos.distance(pad) <= this.padAcceptCm) {
      this.batteryDropped = true
      this.battery.snapTo(pad)
      this.playSfx("step_confirm")
      this.finishFix()
    } else {
      this.battery.returnHome()
      this.cueAtPart(this.battery)
    }
  }

  private onBatteryDragStarted(): void {
    if (this.step === Step.Fix && this.gpuLifted) this.nextCue.setTarget(this.batteryPad)
  }

  private finishFix(viaJumper: boolean = false): void {
    this.waitLeft = this.waitSeconds
    this.jumperPinched = viaJumper
    if (viaJumper) this.playContact()
    this.setStep(Step.Wait)
  }

  /** The tool and the jumper pads are built once, and each stays off until the contact. */
  private buildContactVisuals(): void {
    const jumper = this.jumper.getTransform().getLocalPosition()
    this.contactPoint = new vec3(jumper.x, jumper.y + JUMPER_TOP_CM, jumper.z)
    this.jumperSilkscreen = this.jumper.getSceneObject().children.find((c) => c.name === "Label")
    this.jumperSilkscreenHome = this.jumperSilkscreen.getTransform().getLocalPosition()
    this.rstSilkscreen = this.rstJumper.getSceneObject().children.find((c) => c.name === "Label")
    this.batterySilkscreen = this.battery.getSceneObject().children.find((c) => c.name === "Label")
    const gpuLabelObject = this.gpu.getSceneObject().children.find((c) => c.name === "Label")
    this.gpuSilkscreenText = gpuLabelObject.getComponent("Component.Text") as Text
    this.gpuSilkscreenColor = this.gpuSilkscreenText.textFill.color
    this.dramTag = this.rig.children.find((c) => c.name === "DramTag")
    const memoryLabel = this.memoryStick.getSceneObject().children.find((c) => c.name === "Label")
    const labelSizes: [SceneObject, number][] = [[this.jumperSilkscreen, 56], [this.rstSilkscreen, 62], [this.dramTag, 52], [memoryLabel, 88]]
    for (const [label, size] of labelSizes) (label.getComponent("Component.Text") as Text).size = size
    this.dramTag.getTransform().setLocalPosition(new vec3(5.2, 1.8, 11.4))

    this.screwdriver = global.scene.createSceneObject("Screwdriver")
    this.screwdriver.setParent(this.rig)
    const tool = this.screwdriver.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    tool.mesh = buildScrewdriver()
    tool.mainMaterial = this.makeContactMaterial(SCREWDRIVER_COLOR)
    tool.setRenderOrder(CONTACT_RENDER_ORDER)
    // The blade is built along x. The quarter turn lays it across the CLR_CMOS pins, which run along z.
    this.screwdriver.getTransform().setLocalRotation(quat.rotationFromTo(vec3.up(), SCREWDRIVER_DIRECTION).multiply(quat.angleAxis(Math.PI / 2, vec3.up())))
    this.screwdriver.enabled = false

    this.padFlash = global.scene.createSceneObject("JumperPadFlash")
    this.padFlash.setParent(this.xRay)
    const calloutY = XRAY_CALLOUT_POSITION.y + XRAY_CALLOUT_HALF_Y * XRAY_CALLOUT_SCALE + 0.01
    const calloutPair = this.jumper.getTransform().getLocalPosition().add(this.jumper.targetOffset)
    const calloutPinZ = XRAY_CALLOUT_PIN_OFFSET_CM * XRAY_CALLOUT_SCALE
    const calloutPinRadius = XRAY_CALLOUT_PIN_RADIUS_CM * XRAY_CALLOUT_SCALE
    const flash = this.padFlash.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    flash.mesh = buildPadDiscs([
      new vec4(this.contactPoint.x, this.contactPoint.y + 0.01, this.contactPoint.z - JUMPER_PIN_Z_CM, JUMPER_PIN_RADIUS_CM),
      new vec4(this.contactPoint.x, this.contactPoint.y + 0.01, this.contactPoint.z + JUMPER_PIN_Z_CM, JUMPER_PIN_RADIUS_CM),
      new vec4(calloutPair.x, calloutY, calloutPair.z - calloutPinZ, calloutPinRadius),
      new vec4(calloutPair.x, calloutY, calloutPair.z + calloutPinZ, calloutPinRadius),
    ])
    flash.mainMaterial = this.makeContactMaterial(PAD_FLASH_COLOR)
    flash.setRenderOrder(CONTACT_RENDER_ORDER)
    this.padFlash.enabled = false
    this.padFlashTimer = this.createEvent("DelayedCallbackEvent") as DelayedCallbackEvent
    this.padFlashTimer.bind(() => {
      this.padFlash.enabled = false
    })
  }

  private makeContactMaterial(color: vec4): Material {
    const material = this.overlayMaterial.clone()
    material.mainPass.depthTest = false
    material.mainPass.depthWrite = false
    material.mainPass.twoSided = true
    material.mainPass.baseColor = color
    return material
  }

  /** The tool moves in, the pads flash at the touch, and it leaves. It reuses one vector, so it allocates nothing per frame. */
  private playContact(): void {
    this.contactPlaying = true
    this.screwdriver.enabled = true
    this.placeScrewdriver(SCREWDRIVER_TRAVEL_CM)
    const hold = this.screwdriverHoldSeconds
    const total = CONTACT_APPROACH_SECONDS + hold + CONTACT_RETRACT_SECONDS
    let touched = false
    this.cancelContact = animate({
      duration: total,
      easing: "linear",
      update: (a) => {
        const now = a * total
        let travel = 0
        if (now < CONTACT_APPROACH_SECONDS) {
          const left = 1 - now / CONTACT_APPROACH_SECONDS
          travel = SCREWDRIVER_TRAVEL_CM * left * left * left
        } else if (now >= CONTACT_APPROACH_SECONDS + hold) {
          const out = (now - CONTACT_APPROACH_SECONDS - hold) / CONTACT_RETRACT_SECONDS
          travel = SCREWDRIVER_TRAVEL_CM * out * out
        }
        this.placeScrewdriver(travel)
        if (!touched && now >= CONTACT_APPROACH_SECONDS) {
          touched = true
          this.padFlash.enabled = true
          this.padFlashTimer.reset(this.padFlashSeconds)
          this.playSfx("jumper_contact")
        }
      },
      ended: () => {
        this.cancelContact = null
        this.endContact()
      },
    })
  }

  private placeScrewdriver(travelCm: number): void {
    this.screwdriverPosition.x = this.contactPoint.x + SCREWDRIVER_DIRECTION.x * travelCm
    this.screwdriverPosition.y = this.contactPoint.y + SCREWDRIVER_DIRECTION.y * travelCm
    this.screwdriverPosition.z = this.contactPoint.z + SCREWDRIVER_DIRECTION.z * travelCm
    this.screwdriver.getTransform().setLocalPosition(this.screwdriverPosition)
  }

  /** Ends the contact and the X-ray that was held open for it. */
  private endContact(): void {
    if (!this.contactPlaying) return
    this.contactPlaying = false
    if (this.cancelContact) this.cancelContact()
    this.cancelContact = null
    this.screwdriver.enabled = false
    this.padFlash.enabled = false
    this.setXRayOn(false)
    this.setGpuEdgeAlpha(1)
  }

  /** The silkscreen moves beside the callout while the X-ray is on, because the callout sits over its home. */
  private setXRayOn(on: boolean): void {
    this.xRay.enabled = on
    this.jumperSilkscreen.getTransform().setLocalPosition(on ? CALLOUT_LABEL_LOCAL : this.jumperSilkscreenHome)
    // These labels name parts the X-ray reveals, so they stay hidden until the scan and go with it.
    this.jumperSilkscreen.enabled = on
    this.rstSilkscreen.enabled = on
    this.batterySilkscreen.enabled = on
  }

  /** At the fix, the CLR_CMOS marks turn safe green and the card label goes quiet, so the right pins lead. Both change only on a step change. */
  private setFixFocus(on: boolean): void {
    for (const entry of this.xRaySafeEntries) {
      entry.color.r = on ? SAFE_GREEN.x : XRAY_COLOR.r
      entry.color.g = on ? SAFE_GREEN.y : XRAY_COLOR.g
      entry.color.b = on ? SAFE_GREEN.z : XRAY_COLOR.b
      entry.material.mainPass.baseColor = entry.color
    }
    const c = this.gpuSilkscreenColor
    this.gpuSilkscreenText.textFill.color = new vec4(c.r, c.g, c.b, on ? GPU_SILKSCREEN_QUIET_ALPHA * c.a : c.a)
  }

  private refuse(part: ClearCmosPart): void {
    this.showRefusalLine(part, this.refusalSeconds)
    this.playSfx("refusal_thud")
    part.playRefusal()
    // A pinch already told the user, so the same stay must not warn again.
    this.startEarlyWarningCooldown(part, getTime())
    print("[ClearCmos] refused " + part.getSceneObject().name + " at step " + Step[this.step])
  }

  /** The warning says why this part is a no-go, before contact. A pinch then gets the part's own refusal line. */
  private earlyWarningLine(part: ClearCmosPart): string {
    if (part === this.rstJumper) return "Stop: RST only restarts."
    if (part === this.memoryStick) return "Stop: BIOS reset comes first."
    if (part === this.socket) return "Stop: CPU pins bend easily."
    return "Stop: leave the red part."
  }

  private showRefusalLine(part: ClearCmosPart, seconds: number, text: string = ""): void {
    this.restoreLabelsHiddenByLine()
    const line = text !== "" ? text : part.refusalText !== "" ? part.refusalText : this.genericRefusal
    this.refusalLine.placeAt(this.refusalWorldPosition(part))
    this.refusalLine.show(line, 0)
    this.refusalTimer.reset(seconds)
    // A line below the board collides with nothing. A line in the lane takes the place of the labels while it is on.
    if (this.lineGoesBelowBoard(part)) return
    for (const label of [this.stepLabel, this.stepLabel2, this.symptomLabel]) {
      if (label.getSceneObject().enabled) {
        label.hide()
        this.labelsHiddenByLine.push(label)
      }
    }
  }

  private endRefusalLine(): void {
    this.refusalLine.hide()
    this.restoreLabelsHiddenByLine()
  }

  private restoreLabelsHiddenByLine(): void {
    for (const label of this.labelsHiddenByLine) label.show(label.textValue, 0)
    this.labelsHiddenByLine = []
  }

  /** A button, card, or the first-boot note fills the lane at these steps. The RST warning stays by the RST pins while the card is in place, so the eye does not leave them. */
  private lineGoesBelowBoard(part: ClearCmosPart): boolean {
    if (part === this.rstJumper && this.step === Step.Fix && !this.gpuLifted) return true
    return this.step === Step.Anchor || this.step === Step.Wait || this.step === Step.Rebuild || this.step === Step.Training
  }

  /** The lane above the refused part. A step whose button, card, or note fills the lane puts the line below the board. */
  private refusalWorldPosition(part: ClearCmosPart): vec3 {
    const up = this.lineGoesBelowBoard(part) ? BELOW_BOARD_UP_CM : PANEL_LANE_UP_CM
    return this.panelLane(this.rigLocalX(part), this.refusalLine.widthCm, this.refusalLine.heightCm, up)
  }

  /** A position in the panel lane, clamped so the whole panel stays in the display at the working view. */
  private panelLane(x: number, widthCm: number, heightCm: number, upCm: number = PANEL_LANE_UP_CM): vec3 {
    const local = new vec3(x, 0, 0).add(VIEW_UP.uniformScale(upCm))
    return this.clampToDisplayBand(this.rig.getTransform().getWorldTransform().multiplyPoint(local), widthCm, heightCm)
  }

  private rigLocalX(part: ClearCmosPart): number {
    return this.rig.getTransform().getInvertedWorldTransform().multiplyPoint(part.getTransform().getWorldPosition()).x
  }

  /** The nearest position at which a viewer-facing panel of this size is fully inside the band at the working view. */
  clampToDisplayBand(desired: vec3, widthCm: number, heightCm: number): vec3 {
    const rig = this.rig.getTransform()
    const local = rig.getInvertedWorldTransform().multiplyPoint(desired)
    const forward = local.dot(VIEW_FORWARD)
    const depth = RIG_VIEW_DEPTH_CM + forward
    const maxX = Math.max(0, DISPLAY_HALF_TAN_X * depth - widthCm / 2 - BAND_MARGIN_CM)
    const maxUp = Math.max(0, DISPLAY_HALF_TAN_Y * depth - heightCm / 2 - BAND_MARGIN_CM)
    const x = Math.min(maxX, Math.max(-maxX, local.x))
    const up = Math.min(maxUp, Math.max(-maxUp, local.dot(VIEW_UP)))
    const placed = new vec3(x, 0, 0).add(VIEW_UP.uniformScale(up)).add(VIEW_FORWARD.uniformScale(forward))
    return rig.getWorldTransform().multiplyPoint(placed)
  }

  private setStep(next: Step): void {
    this.step = next
    this.symptomButton.getSceneObject().enabled = next === Step.Symptom
    this.ledHalo.enabled = next === Step.Symptom
    this.ledLeader.enabled = next === Step.Symptom
    this.anchorButton.getSceneObject().enabled = next === Step.Anchor
    this.rebuildButton.getSceneObject().enabled = next === Step.Rebuild
    this.waitCard.getSceneObject().enabled = next === Step.Wait
    if (next >= Step.Rebuild) this.endContact()
    this.setXRayOn((next >= Step.PowerCord && next <= Step.Fix) || (next === Step.Wait && this.contactPlaying))
    this.setFixFocus(next === Step.Fix || (next === Step.Wait && this.contactPlaying))
    this.ribbon.enabled = next >= Step.PowerCord && next <= Step.Fix
    if (next === Step.PowerCord && this.ribbonClock < 0) {
      this.ribbonClock = 0
      this.playSfx("ribbon_draw")
      this.igniteXRay()
    }
    if (next > Step.Fix) {
      this.glass.setColliderEnabled(true)
      this.gpu.setColliderEnabled(true)
      if (!this.contactPlaying) this.setGpuEdgeAlpha(1)
    }
    this.arrow.setActive(next === Step.PowerCord)
    this.dramLed.enabled = next !== Step.Done
    this.dramTag.enabled = next !== Step.Done
    this.setMonitorEdgeAlpha(this.monitorEdgeAlphaFor(next))
    this.battery.setDragAllowed(next === Step.Fix && this.gpuLifted)
    this.batteryPad.enabled = next === Step.Fix && this.gpuLifted
    if (next === Step.Wait) {
      this.waitCard.getSceneObject().getTransform().setWorldPosition(this.panelLane(WAIT_CARD_X_CM, this.waitCard.widthCm, this.waitCard.heightCm, WAIT_CARD_UP_CM))
      this.waitCard.setRemaining(this.waitLeft)
    }
    if (next === Step.Training) this.trainingLeft = this.trainingSeconds
    if (next === Step.Done) {
      this.monitor.showBoot()
      this.playDoneRing()
      this.playSfx("boot_ring")
    }

    for (const p of this.parts) {
      p.setRing(false)
      // A hover outline must not outlive the step it was shown for (B4).
      p.clearHover()
      p.hoverKind = p.decoy ? "decoy" : "none"
      // The RST pins are a wrong reach only at the fix, because nothing asks for them before it.
      p.setNoGoArmed(p === this.rstJumper ? next === Step.Fix : next >= Step.PowerCord && next <= Step.Fix)
      // U3: at the fix the wrong pins already read as wrong before any reach.
      p.setNoGoCurrent(p === this.rstJumper && next === Step.Fix)
      // The opening has one live target. Nothing else may catch the cursor ray or refuse.
      // Plan L4: at the fix, the power button must not catch a ray aimed at the pins beside it.
      p.setColliderEnabled(next >= Step.PowerCord && !(p === this.powerButton && next === Step.Fix))
    }
    this.refusalLine.hide()
    this.labelsHiddenByLine = []
    this.stepLabel.hide()
    this.stepLabel2.hide()
    // Plan L2: at the opening the prompt sits below the board, next to the light it names, and the caution takes the top lane.
    if (next === Step.Symptom) {
      this.symptomNote.placeAt(this.panelLane(0, this.symptomNote.widthCm, this.symptomNote.heightCm))
      this.symptomNote.show(this.symptomLabelLine2, 0)
    } else {
      this.symptomNote.hide()
    }
    if (next === Step.Symptom) this.showBigLabel(this.symptomLabelLine1, this.symptomLabel.textSize, undefined, BELOW_BOARD_UP_CM)
    else if (next === Step.Training) this.showBigLabel(TRAINING_LABEL)
    else if (next === Step.Done) this.showBigLabel(DONE_LABEL + "\n" + DONE_MONITOR_LINE + "\n" + DONE_NEXT_LINE, DONE_TEXT_SIZE, DONE_TEXT_COLOR)
    else this.symptomLabel.hide()

    if (next === Step.PowerCord) this.markNext(this.powerCord, this.cordLabel, this.stepLabel)
    if (next === Step.Glass) this.markNext(this.glass, this.glassLabel, this.stepLabel)
    if (next === Step.Fix) {
      this.markNext(this.jumper, this.jumperLabel, this.stepLabel, FIX_PRIMARY_LANE_X_CM)
      // The GPU is an option, not the next step, so it gets a short secondary line and a hover but no ring.
      this.gpu.hoverKind = "next"
      this.stepLabel2.placeAt(this.panelLane(FIX_SECONDARY_LANE_X_CM, this.stepLabel2.widthCm, this.stepLabel2.heightCm))
      this.stepLabel2.show(this.gpuLabel, 1)
    }
    if (next === Step.PowerOn) this.markNext(this.powerButton, this.powerLabel, this.stepLabel)
    this.updateNextCue(next)
    print("[ClearCmos] step=" + Step[next])
  }

  /** One arrow, at the place the user must act now. Steps with nothing to do hide it, the moment the step changes. */
  private updateNextCue(next: Step): void {
    if (next === Step.Symptom) this.nextCue.setTarget(this.dramLed, new vec3(0, LED_HALO_LIFT_CM, 0), this.symptomButton.getSceneObject(), LED_HALO_RADIUS_CM)
    else if (next === Step.Anchor) this.cueAtButton(this.anchorButton)
    else if (next === Step.PowerCord) this.cueAtPart(this.powerCord)
    // A label stands close above these two rings, so a 3.8 cm arrow stays off the text only with its tip at the ring center.
    else if (next === Step.Glass) this.cueIntoRing(this.glass)
    // Beside the CLR_CMOS label, so the head does not touch its last letter.
    else if (next === Step.Fix) this.cueIntoRing(this.jumper, JUMPER_CUE_RIGHT_CM)
    else if (next === Step.Rebuild) this.cueAtButton(this.rebuildButton)
    else if (next === Step.PowerOn) this.cueAtPart(this.powerButton)
    else this.nextCue.setTarget(null)
  }

  private cueAtPart(part: ClearCmosPart): void {
    this.nextCue.setTarget(part.ringObject, part.homeOffsetWorld, part.getSceneObject(), part.ringRadiusCm)
  }

  private cueIntoRing(part: ClearCmosPart, rightCm: number = 0): void {
    const offset = part.homeOffsetWorld.add(this.rig.getTransform().right.uniformScale(rightCm))
    this.nextCue.setTarget(part.ringObject, offset, part.getSceneObject(), 0, 0)
  }

  private cueAtButton(button: ClearCmosActionButtonUI): void {
    const top = button.getTransform().up.uniformScale(button.heightCm * 0.5)
    this.nextCue.setTarget(button.getSceneObject(), top)
  }

  /** The one large panel. It carries the opening prompt, the first-boot note, and the final line. */
  private showBigLabel(text: string, textSize: number = this.symptomLabel.textSize, color?: vec4, upCm: number = PANEL_LANE_UP_CM): void {
    this.symptomLabel.setTextSize(textSize)
    this.symptomLabel.placeAt(this.panelLane(SYMPTOM_LABEL_X_CM, this.symptomLabel.widthCm, this.symptomLabel.heightCm, upCm))
    this.symptomLabel.show(text, 0, color)
  }

  /** XRay turns on at once with setStep. The sweep then ignites each part as it crosses it. */
  private igniteXRay(): void {
    this.xRayScanBar.enabled = true
    this.playSfx("xray_sweep")
    animate({
      duration: SHELL_FILL_FADE_SECONDS,
      easing: "ease-out-cubic",
      update: (a) => this.setShellFill(1 - a),
    })
    const transform = this.xRayScanBar.getTransform()
    animate({
      duration: XRAY_SCAN_SECONDS,
      easing: "ease-in-out-cubic",
      update: (a) => {
        const x = XRAY_SCAN_FROM_X_CM + (XRAY_SCAN_TO_X_CM - XRAY_SCAN_FROM_X_CM) * a
        this.xRayScanPosition.x = x
        transform.setLocalPosition(this.xRayScanPosition)
        for (const entry of this.xRayEntries) {
          if (!entry.ignited && x >= entry.x) this.igniteXRayEntry(entry)
        }
      },
      ended: () => {
        this.xRayScanBar.enabled = false
      },
    })
    animate({
      duration: EDGE_RAMP_SECONDS,
      easing: "ease-out-cubic",
      update: (a) => this.setGpuEdgeAlpha(1 + (GPU_XRAY_EDGE_ALPHA - 1) * a),
    })
  }

  private igniteXRayEntry(entry: { x: number; material: Material; color: vec4; ignited: boolean }): void {
    entry.ignited = true
    animate({
      duration: XRAY_IGNITE_SECONDS,
      easing: "ease-out-cubic",
      update: (a) => {
        entry.color.a = XRAY_COLOR.a * a
        entry.material.mainPass.baseColor = entry.color
      },
    })
  }

  private markNext(part: ClearCmosPart, text: string, label: ClearCmosLabelUI, laneX: number = this.rigLocalX(part)): void {
    part.setRing(true)
    part.hoverKind = "next"
    label.placeAt(this.panelLane(laneX, label.widthCm, label.heightCm))
    label.show(text, 1)
  }
}
