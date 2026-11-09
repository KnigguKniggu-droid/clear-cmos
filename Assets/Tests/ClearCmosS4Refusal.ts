// Done criterion 4: decoys and out-of-order parts are refused and stay in place.
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { Step } from "../Scripts/ClearCmosFlow"
import {
  ClearCmosLeafInteractor,
  expectRefused,
  WARNING_LINES,
  expectRefusalLineInView,
  expectRefusalMotion,
  expectRings,
  expectMemoryWinsRay,
  expectStep,
  liftAndCheck,
  main,
  must,
  noGoAlpha,
  noGoAlphaForRayGap,
  noGoEnabled,
  part,
  sampleRefusal,
  settle,
  sfxCount,
  worldPosition,
} from "./ClearCmosTestSupport"

const MEMORY_LINE = "Try the BIOS reset first."
const GENERIC_LINE = "Follow the green ring first."

@component
export class ClearCmosS4Refusal extends Scenario {
  async run(): Promise<void> {
    const interactor = new ClearCmosLeafInteractor()
    await interactor.reachAnchorDone()
    await expectMemoryWinsRay()

    const stick = part("MemoryStick").getSceneObject()
    const outline = stick.children.find((c) => c.name === "Outline")
    must(!!outline, "MemoryStick has no Outline child")
    for (const decoy of ["MemoryStick", "Socket", "BatteryRedPart"]) {
      must(noGoEnabled(decoy), decoy + " no-go box is not on after Anchor")
    }
    must(!noGoEnabled("PowerCord"), "PowerCord shows a no-go box while it is the next part")
    const idleAlpha = noGoAlpha("MemoryStick")

    // Proximity through the real distance path: a ray 10 cm off the box half-strengthens it, a ray 30 cm off leaves it idle.
    const nearRay = await noGoAlphaForRayGap("MemoryStick", 10)
    const farRay = await noGoAlphaForRayGap("MemoryStick", 30)
    print("[ClearCmosLeaf] no-go alpha by ray gap: 10 cm " + nearRay.toFixed(3) + ", 30 cm " + farRay.toFixed(3) + ", idle " + idleAlpha.toFixed(3))
    must(nearRay > idleAlpha + 0.1 && nearRay < idleAlpha + 0.32, "MemoryStick alpha at a 10 cm ray gap is " + nearRay.toFixed(3))
    must(farRay < idleAlpha + 0.03, "MemoryStick alpha at a 30 cm ray gap is " + farRay.toFixed(3))

    const hovering = interactor.hoverPart("MemoryStick", 1200)
    await settle(700)
    must(outline.enabled, "MemoryStick red outline is not on during hover")
    // The early warning: 700 ms in the box is past the 350 ms dwell, and no pinch has happened. The reason waits for a pinch.
    expectRefused("MemoryStick", WARNING_LINES.MemoryStick)
    const nearAlpha = noGoAlpha("MemoryStick")
    print("[ClearCmosLeaf] no-go alpha idle " + idleAlpha.toFixed(3) + " near " + nearAlpha.toFixed(3))
    must(nearAlpha > idleAlpha + 0.2, "MemoryStick no-go box did not strengthen near the cursor")
    await hovering
    await settle(300)
    must(noGoAlpha("MemoryStick") < nearAlpha - 0.2, "MemoryStick no-go box did not relax after the cursor left")

    const stickBefore = worldPosition("MemoryStick")
    const stickSample = sampleRefusal("MemoryStick", 1500)
    const thudsBefore = sfxCount("refusal_thud")
    await interactor.pinch("MemoryStick")
    expectRefusalMotion("MemoryStick", await stickSample)
    must(sfxCount("refusal_thud") === thudsBefore + 1, "the refused pinch played refusal_thud " + (sfxCount("refusal_thud") - thudsBefore) + " times")
    expectStep(Step.PowerCord)
    must(worldPosition("MemoryStick").distance(stickBefore) < 0.01, "MemoryStick moved")
    expectRefused("MemoryStick", MEMORY_LINE)
    expectRefusalLineInView("MemoryStick")
    expectRings(["PowerCord"])

    const glassBefore = worldPosition("Glass")
    const glassSample = sampleRefusal("Glass", 1500)
    await interactor.pinch("Glass")
    expectRefusalMotion("Glass", await glassSample)
    must(!noGoEnabled("Glass"), "Glass no-go box stayed on after the flash")
    expectStep(Step.PowerCord)
    must(worldPosition("Glass").distance(glassBefore) < 0.01, "Glass moved while PowerCord was next")
    expectRefused("Glass", GENERIC_LINE)
    expectRefusalLineInView("Glass")
    expectRings(["PowerCord"])

    // Proves the triggers above reach the parts: the same trigger on the valid part advances.
    await liftAndCheck(interactor, "PowerCord", Step.Glass)

    // The memory also wins at the next steps, and refuses with its own line.
    await expectMemoryWinsRay()
    await interactor.pinch("MemoryStick")
    expectStep(Step.Glass)
    expectRefused("MemoryStick", MEMORY_LINE)
    expectRefusalLineInView("MemoryStick")
    await liftAndCheck(interactor, "Glass", Step.Fix)
    await expectMemoryWinsRay()
    await interactor.pinch("MemoryStick")
    expectStep(Step.Fix)
    expectRefused("MemoryStick", MEMORY_LINE)
    expectRefusalLineInView("MemoryStick")
  }
}
