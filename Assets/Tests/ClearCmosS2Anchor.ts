// Done criterion 2: symptom and anchor turn on the X-ray, the arrow, and one ring.
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils"
import { Step } from "../Scripts/ClearCmosFlow"
import {
  ClearCmosLeafInteractor,
  expectArrowHasShaft,
  expectShellFill,
  expectRibbonDrawn,
  expectRibbonFollowsRoute,
  expectRings,
  expectStep,
  expectThinOverlays,
  expectXRayLit,
  expectXRaySweep,
  isEnabled,
  main,
  must,
  sampleRibbonDraw,
  sampleXRaySweep,
  sfxCount,
  workingViewTan,
  worldPosition,
} from "./ClearCmosTestSupport"

@component
export class ClearCmosS2Anchor extends Scenario {
  async run(): Promise<void> {
    const interactor = new ClearCmosLeafInteractor()
    const ribbonSample = sampleRibbonDraw(4600)
    const sweepSample = sampleXRaySweep(4600)
    await interactor.reachAnchorDone()
    expectStep(Step.PowerCord)
    must(isEnabled("XRay"), "XRay is not on")
    expectRings(["PowerCord"])

    must(isEnabled("Arrow"), "Arrow is not enabled")
    const arrow = worldPosition("Arrow")
    const toCord = worldPosition("PowerCord").sub(arrow).normalize()
    const rotation = main().arrow.arrow.getTransform().getWorldRotation()
    const pointing = rotation.multiplyVec3(vec3.forward())
    must(pointing.dot(toCord) > 0.98, "Arrow dot to PowerCord is " + pointing.dot(toCord).toFixed(3))
    // Brief: a chime when the arrow appears. It plays once, not per frame.
    must(sfxCount("chime") === 1, "the out-of-view chime played " + sfxCount("chime") + " times, expected 1")

    must(isEnabled("SafePathRibbon"), "SafePathRibbon is not on after Anchor")
    expectRibbonFollowsRoute()
    expectArrowHasShaft()
    // The arrow sits below the BoardLabel strip, so it does not overlap the scene label.
    const arrowTan = workingViewTan("Arrow")
    print("[ClearCmosLeaf] Arrow tan y " + arrowTan.y.toFixed(3))
    must(arrowTan.y < -0.165, "Arrow is at tan y " + arrowTan.y.toFixed(3) + ", on the BoardLabel strip")
    expectThinOverlays()
    must(!isEnabled("BatteryPad"), "BatteryPad is on before the fix")

    const buttonLabel = main().anchorButton.getSceneObject().children.find((c) => c.name === "ButtonLabel")
    must(!!buttonLabel, "AnchorButton has no ButtonLabel")
    const anchorText = buttonLabel.getComponent("Component.Text").text
    must(anchorText === "Scan this PC (simulated)", 'AnchorButton says "' + anchorText + '"')
    const boardText = findSceneObjectByName("BoardLabel").getComponent("Component.Text").text
    must(boardText === "Simulated PC layout. Visual guidance only.", 'BoardLabel says "' + boardText + '"')

    expectRibbonDrawn(await ribbonSample)
    expectXRaySweep(await sweepSample)
    expectXRayLit()
    // Panel 1 fix 5: the fill has faded after the scan, so the amber marks are the reveal.
    expectShellFill("GpuVisual", 0)
    expectShellFill("GlassVisual", 0)
    // The scan is what shows the Battery silkscreen. It stayed hidden until now (S1).
    const batteryLabel = findSceneObjectByName("Battery").children.find((c) => c.name === "Label")
    must(!!batteryLabel && batteryLabel.enabled, "Battery Label is not on after the scan")
  }
}
