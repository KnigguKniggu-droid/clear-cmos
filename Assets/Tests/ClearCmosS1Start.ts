// Done criterion 1: the dead state at Lens start, with the DRAM light as the hero of the opening.
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils"
import { Step } from "../Scripts/ClearCmosFlow"
import {
  ClearCmosLeafInteractor,
  edgeAlpha,
  expectChassisOutline,
  expectMonitorEdgeAlpha,
  expectShellFill,
  expectTableEdge,
  PART_NAMES,
  PART_VISUALS,
  part,
  expectInLane,
  expectPanelClearOfParts,
  expectLabelRemoved,
  expectPanelInBand,
  expectPanelTextFits,
  expectPartWinsRay,
  expectStep,
  eyeRayGapCm,
  isEnabled,
  labelText,
  main,
  monitorText,
  must,
  ledGlowRatio,
  rigLocal,
  sampleLedHaloRange,
  settle,
  workingViewTan,
} from "./ClearCmosTestSupport"

const SYMPTOM_TEXT = "DRAM light stuck on? Pinch it."
const SYMPTOM_NOTE_TEXT = "If it just started, wait. Memory training can look like this."
/** Punch-list Fix 6: the glow pulses with the halo, at 0.45 of its alpha. */
const LED_GLOW_RATIO = 0.45
const LED_HALO_RADIUS_CM = 3.5
/** The lane below the board, as a literal so the check does not ask ClearCmosMain. */
const BELOW_BOARD_UP_CM = -16
const BOARD_TEXT = "Simulated PC layout. Visual guidance only."
/** The display band of the Specs preview at the working view. */
const BAND_TAN_X = 0.21
const BAND_TAN_Y = 0.24
/** The 2 x 2 status LED block in rig-local cm (board-layout.md, W-07). The limit is half the 0.6 cm block plus the 0.3 cm estimate error. */
const STATUS_LED_BLOCK_X_CM = -0.1
const STATUS_LED_BLOCK_Z_CM = 11.4
const STATUS_LED_LIMIT_CM = 0.6

@component
export class ClearCmosS1Start extends Scenario {
  async run(): Promise<void> {
    await settle(1500)
    expectStep(Step.Symptom)
    // A LEAF pinch forces its target and ignores colliders, so only this check sees a collider that would catch a real cursor.
    for (const name of PART_NAMES) must(!part(name)["collider"].enabled, name + " collider is on at Symptom, so a real cursor can refuse it")
    must(isEnabled("DramLed"), "DramLed is not on")
    const ledOnBoard = rigLocal("DramLed")
    const ledOffBlock = Math.hypot(ledOnBoard.x - STATUS_LED_BLOCK_X_CM, ledOnBoard.z - STATUS_LED_BLOCK_Z_CM)
    print("[ClearCmosLeaf] DramLed is " + ledOffBlock.toFixed(2) + " cm from the status LED block")
    must(ledOffBlock <= STATUS_LED_LIMIT_CM, "DramLed is " + ledOffBlock.toFixed(2) + " cm from the status LED block, limit " + STATUS_LED_LIMIT_CM)
    must(monitorText() === "No signal", 'MonitorScreen says "' + monitorText() + '"')
    must(isEnabled("SymptomButton"), "SymptomButton is not visible")

    // The hero light: inside the band, with the pinch target on its eye ray.
    const led = workingViewTan("DramLed")
    print("[ClearCmosLeaf] DramLed tan x " + led.x.toFixed(3) + " y " + led.y.toFixed(3))
    must(Math.abs(led.x) < BAND_TAN_X && Math.abs(led.y) < BAND_TAN_Y, "DramLed is outside the display band")
    const gap = eyeRayGapCm("SymptomButton", "DramLed")
    print("[ClearCmosLeaf] SymptomButton eye-ray gap to DramLed " + gap.toFixed(2) + " cm")
    must(gap < 3, "SymptomButton eye ray misses DramLed by " + gap.toFixed(2) + " cm")
    must(main().symptomButton.heightCm <= 4 && main().symptomButton.widthCm <= 4, "SymptomButton is a large panel, not a target on the light")

    // Panel 1 fix 5 and 6: full-brightness edges from the start, the shell fill, the chassis, and the table edge.
    must(edgeAlpha() > 0.95, "edge alpha at the opening is " + edgeAlpha().toFixed(2))
    expectShellFill("GpuVisual", 1)
    expectShellFill("GlassVisual", 1)
    expectChassisOutline()
    expectTableEdge()
    // Audit: the open Monitor cage stays quiet until the first boot.
    expectMonitorEdgeAlpha(0.3)
    must(isEnabled("LedHalo"), "LedHalo is not on at the opening")
    must(isEnabled("LedLeader"), "LedLeader is not on at the opening")
    const haloRadius = findSceneObjectByName("LedHalo").getTransform().getLocalScale().x
    must(Math.abs(haloRadius - LED_HALO_RADIUS_CM) < 0.01, "LedHalo radius is " + haloRadius.toFixed(2) + ", expected " + LED_HALO_RADIUS_CM)
    // W-12: the words at the light say DRAM, not only Memory.
    const dramTag = findSceneObjectByName("DramTag")
    must(!!dramTag && dramTag.isEnabledInHierarchy, "DramTag is not on at the opening")
    const dramTagText = dramTag.getComponent("Component.Text").text
    must(dramTagText === "DRAM", 'DramTag says "' + dramTagText + '"')
    const halo = await sampleLedHaloRange(1900)
    print("[ClearCmosLeaf] LedHalo alpha range " + halo.x.toFixed(2) + " to " + halo.y.toFixed(2))
    must(halo.x < 0.4 && halo.y > 0.9, "LedHalo alpha only moved from " + halo.x.toFixed(2) + " to " + halo.y.toFixed(2))
    must(isEnabled("LedGlow"), "LedGlow is not on at the opening")
    const glowRatio = ledGlowRatio()
    print("[ClearCmosLeaf] LedGlow alpha ratio to LedHalo " + glowRatio.toFixed(3))
    must(Math.abs(glowRatio - LED_GLOW_RATIO) < 0.03, "LedGlow alpha is " + glowRatio.toFixed(3) + " of LedHalo, expected " + LED_GLOW_RATIO)

    must(isEnabled("SymptomLabel"), "SymptomLabel is not on")
    must(labelText("SymptomLabel") === SYMPTOM_TEXT, 'SymptomLabel says "' + labelText("SymptomLabel") + '"')
    // Plan L2: the prompt sits below the board and the caution takes the top lane.
    expectInLane("SymptomLabel", 1.35, BELOW_BOARD_UP_CM)
    expectPanelInBand("SymptomLabel", main().symptomLabel.widthCm, main().symptomLabel.heightCm)
    expectPanelTextFits("SymptomLabel")
    expectPanelClearOfParts("SymptomLabel", new vec2(main().symptomLabel.widthCm, main().symptomLabel.heightCm), PART_VISUALS)

    // Punch-list Fix 4: the caution has its own panel below the board, so line 1 can reach size 68.
    must(isEnabled("SymptomNote"), "SymptomNote is not on")
    expectInLane("SymptomNote", 0)
    must(labelText("SymptomNote") === SYMPTOM_NOTE_TEXT, 'SymptomNote says "' + labelText("SymptomNote") + '"')
    must(main().symptomLabel.textSize === 68, "SymptomLabel text size is " + main().symptomLabel.textSize + ", expected 68")
    expectPanelInBand("SymptomNote", main().symptomNote.widthCm, main().symptomNote.heightCm)
    expectPanelTextFits("SymptomNote")
    expectPanelClearOfParts("SymptomNote", new vec2(main().symptomNote.widthCm, main().symptomNote.heightCm), PART_VISUALS)

    // Silkscreen stays only on GPU, Memory, Battery, Jumper; the board label says the layout is simulated.
    for (const name of ["Glass", "Socket", "BatteryRedPart", "PowerCord", "PowerButton"]) expectLabelRemoved(name)
    // The judging panel: the CLR_CMOS and Battery labels wait for the scan, so the X-ray reveals them.
    for (const name of ["Jumper", "Battery", "RstJumper"]) expectLabelRemoved(name)
    const boardText = findSceneObjectByName("BoardLabel").getComponent("Component.Text").text
    must(boardText === BOARD_TEXT, 'BoardLabel says "' + boardText + '"')
    // The judging panel renamed the card. The old model name must not come back.
    const gpuLabel = findSceneObjectByName("GPU").children.find((c) => c.name === "Label")
    must(!!gpuLabel, "GPU has no Label child")
    const gpuText = gpuLabel.getComponent("Component.Text").text
    must(gpuText === "Graphics card", 'GPU Label says "' + gpuText + '", expected "Graphics card"')

    // LEAF forces its target, so this ray proves that a real cursor reaches the light through the Glass.
    await expectPartWinsRay("SymptomButton")

    const interactor = new ClearCmosLeafInteractor()
    await interactor.pinch("SymptomButton")
    await settle(600)
    expectStep(Step.Anchor)
    must(!isEnabled("SymptomLabel"), "SymptomLabel stayed on after the pinch")
    must(!isEnabled("SymptomNote"), "SymptomNote stayed on after the pinch")
    must(!isEnabled("LedHalo"), "LedHalo stayed on after the pinch")
    must(!isEnabled("LedLeader"), "LedLeader stayed on after the pinch")
    must(edgeAlpha() > 0.95, "edge alpha at Anchor is " + edgeAlpha().toFixed(2))
    // The scan has not run yet, so the shells keep their fill until it does.
    expectShellFill("GpuVisual", 1)
    expectShellFill("GlassVisual", 1)
    await expectPartWinsRay("AnchorButton")
    for (const name of PART_NAMES) must(!part(name)["collider"].enabled, name + " collider is on at Anchor, so a real cursor can refuse it")
    expectPanelTextFits("AnchorButton")
    expectPanelClearOfParts("AnchorButton", new vec2(main().anchorButton.widthCm, main().anchorButton.heightCm), PART_VISUALS)
  }
}
