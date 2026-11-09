// Done criterion 3: PowerCord, then Glass, each with one next ring and label. Jumper is then the default next step.
// The GPU is required only on the battery route.
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils"
import { Step } from "../Scripts/ClearCmosFlow"
import {
  AFTER_STEP_MS,
  ClearCmosLeafInteractor,
  expectLabel,
  expectPanelTextFits,
  expectPartWinsRay,
  expectRefused,
  expectRings,
  expectStep,
  isEnabled,
  labelText,
  liftAndCheck,
  main,
  must,
  outlineOnAtStepChange,
  part,
  refusalLineSeenDuring,
  settle,
  worldPosition,
} from "./ClearCmosTestSupport"

@component
export class ClearCmosS3Order extends Scenario {
  async run(): Promise<void> {
    const interactor = new ClearCmosLeafInteractor()
    await interactor.reachAnchorDone()
    main().refusalSeconds = 1

    await liftAndCheck(interactor, "PowerCord", Step.Glass)
    expectRings(["Glass"])
    expectLabel("StepLabel", "Glass", "Lift the glass side panel")
    must(!isEnabled("StepLabel2"), "StepLabel2 is on at the Glass step")

    const gpuHome = worldPosition("GPU")
    const batteryHome = worldPosition("Battery")

    // Directly after Glass, the Jumper is the one next step and the GPU stays in place.
    // B4: the Glass outline shows under the cursor, and it must not outlive the step when the pinch moves on.
    const glassOutline = findSceneObjectByName("Glass").children.find((c) => c.name === "Outline")
    must(!!glassOutline, "Glass has no Outline child")
    const hovering = interactor.hoverPart("Glass", 300)
    await settle(200)
    must(glassOutline.enabled, "Glass outline is not on while the cursor rests on it")
    await hovering
    await settle(200)

    const glassBefore = worldPosition("Glass")
    const atChange = outlineOnAtStepChange("Glass", Step.Glass, 1200)
    // A double press on the Glass: the second trigger reaches the card underneath while the Glass is still lifting.
    const lifting = await interactor.doublePress("Glass", "GPU")
    must(lifting, "the second trigger ended after the Glass lift, so the double press proved nothing")
    const outline = await atChange
    must(outline.changed, "the step never left Glass")
    must(!outline.outlineOn, "Glass outline was still on in the first frame of the next step")
    await settle(AFTER_STEP_MS)
    expectStep(Step.Fix)
    must(worldPosition("Glass").distance(glassBefore) > 1, "Glass did not move away")
    expectRings(["Jumper"])
    must(!part("PowerButton")["collider"].enabled, "PowerButton collider is on at the fix, so it can catch a ray aimed at the pins")
    must(worldPosition("GPU").distance(gpuHome) < 0.01, "GPU moved on a second trigger during the Glass lift")
    must(!isEnabled("RefusalLine"), "the second trigger during the Glass lift was refused, it must be ignored")
    must(!isEnabled("BatteryPad"), "BatteryPad is on before the battery route opens")
    // Audit: the primary instruction reads first, on the left, and the fallback is one short line after it.
    expectLabel("StepLabel", "Jumper", "Pinch CLR_CMOS pins", -8.5)
    expectPanelTextFits("StepLabel")
    expectLabel("StepLabel2", "GPU", "Or lift graphics card", 8.5)
    must(labelText("StepLabel2").indexOf(".") < 0 && labelText("StepLabel2").length < labelText("StepLabel").length * 2, 'the fallback line is not short: "' + labelText("StepLabel2") + '"')
    await expectPartWinsRay("Jumper")

    // B2: a second pinch on a part already lifted away changes nothing and is not refused.
    const refusalSeenOnRepeat = refusalLineSeenDuring(800)
    const cordBefore = worldPosition("PowerCord")
    await interactor.pinch("PowerCord")
    await interactor.pinch("Glass")
    must(!(await refusalSeenOnRepeat), "RefusalLine came on for a part already lifted away")
    expectStep(Step.Fix)
    must(worldPosition("PowerCord").distance(cordBefore) < 0.01, "PowerCord moved on a repeat pinch")

    // The battery route is closed until the GPU is lifted.
    await interactor.pinch("Battery")
    expectStep(Step.Fix)
    expectRefused("Battery", null)
    must(worldPosition("Battery").distance(batteryHome) < 0.01, "Battery moved before the GPU was lifted")
    await settle(1200)

    // Lifting the GPU opens the battery route and keeps the Jumper as an option: the two rings at the fix.
    await liftAndCheck(interactor, "GPU", Step.Fix)
    expectRings(["Jumper", "Battery"])
    must(isEnabled("BatteryPad"), "BatteryPad is off after the GPU lift")
    expectLabel("StepLabel", "Jumper", "Pinch CLR_CMOS pins", -8.5)
    expectLabel("StepLabel2", "Battery", "Drag battery to green pad", 8.5)
    // The brief keeps the real-card caveat. It shows only once the card lifts, on the panel below the board.
    must(isEnabled("SymptomNote"), "SymptomNote is off after the GPU lift, so the real-card caveat is gone")
    must(labelText("SymptomNote") === "Real card: screw, latch, power cables.", 'SymptomNote says "' + labelText("SymptomNote") + '"')
  }
}
