// Done criterion 5, battery drag path. Asserts the battery position, not only the final state.
// The GPU is lifted first: it is required only on this route.
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { Step } from "../Scripts/ClearCmosFlow"
import {
  ClearCmosLeafInteractor,
  expectStep,
  finishAfterFix,
  isEnabled,
  main,
  must,
  part,
  refusalLineSeenDuring,
  settle,
  sfxCount,
  waitUntilEnabled,
  worldPosition,
} from "./ClearCmosTestSupport"

@component
export class ClearCmosS5bBattery extends Scenario {
  async run(): Promise<void> {
    main().waitSeconds = 1
    const interactor = new ClearCmosLeafInteractor()
    await interactor.reachFix()
    expectStep(Step.Fix)
    const confirmsBeforeGpu = sfxCount("step_confirm")
    await interactor.liftGpu()
    expectStep(Step.Fix)
    must(sfxCount("step_confirm") === confirmsBeforeGpu + 1, "the GPU lift played step_confirm " + (sfxCount("step_confirm") - confirmsBeforeGpu) + " times")
    must(isEnabled("BatteryPad"), "BatteryPad is off after the GPU lift")

    const start = worldPosition("Battery")
    const pad = worldPosition("BatteryPad")

    // B3: a short drop starts the 0.8 s return. A re-grab during it must stop the animation.
    const away = start.sub(pad).normalize()
    await interactor.dragBy("Battery", away.uniformScale(1.5), 400, 0)
    must(part("Battery").isMoving, "the short drop did not start a return animation, so the re-grab check would prove nothing")
    const movingWhileHeld = await interactor.regrabDuringReturn("Battery", away.uniformScale(0.05), 300)
    must(!movingWhileHeld, "the return animation kept moving the Battery after the re-grab")
    await settle(1000)
    must(worldPosition("Battery").distance(start) < 0.05, "Battery did not return home after the short drops")
    expectStep(Step.Fix)

    const seen = waitUntilEnabled("WaitCard", 600)
    // The successful drop must not read as a refusal, during the drag or the wait.
    const refusalSeen = refusalLineSeenDuring(2800)
    const confirmsBeforeDrop = sfxCount("step_confirm")
    const thudsBeforeDrop = sfxCount("refusal_thud")
    await interactor.dragBy("Battery", pad.sub(start), 1500)
    must(await seen, "WaitCard never turned on after the Battery drag")
    must(!(await refusalSeen), "RefusalLine came on during the battery drop")
    must(sfxCount("step_confirm") === confirmsBeforeDrop + 1, "the battery drop played step_confirm " + (sfxCount("step_confirm") - confirmsBeforeDrop) + " times")
    must(sfxCount("refusal_thud") === thudsBeforeDrop, "the battery drop played refusal_thud")
    must(sfxCount("jumper_contact") === 0, "jumper_contact played on the battery route")
    // The screwdriver and the held X-ray belong to the jumper route only.
    must(!isEnabled("Screwdriver"), "Screwdriver came on during the battery route")
    must(!isEnabled("XRay"), "XRay stayed on after the battery drop")

    const end = worldPosition("Battery")
    must(end.distance(start) >= main().minDragCm, "Battery moved only " + end.distance(start).toFixed(2) + " cm")
    must(end.distance(pad) <= main().padAcceptCm, "Battery ended " + end.distance(pad).toFixed(2) + " cm from BatteryPad")

    await finishAfterFix(interactor)
  }
}
