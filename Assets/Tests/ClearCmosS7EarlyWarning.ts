// Build priority 1: the cursor rests in a no-go box for 350 ms, and the Lens warns before any pinch.
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import { Step } from "../Scripts/ClearCmosFlow"
import {
  AFTER_STEP_MS,
  ClearCmosLeafInteractor,
  currentStep,
  earlyWarningCount,
  expectEarlyWarningFlash,
  expectLabel,
  expectPanelsApart,
  expectWarningHold,
  noGoFillAlpha,
  expectRefused,
  expectRefusalLineInView,
  expectStep,
  isEnabled,
  liftAndCheck,
  main,
  must,
  noGoAlpha,
  part,
  sampleEarlyWarning,
  settle,
  sfxCount,
  WARNING_LINE,
  worldPosition,
} from "./ClearCmosTestSupport"

const SHORT_HOVER_MS = 150
const WARNING_HOVER_MS = 500
const FIRST_WINDOW_MS = 1200
const REPEAT_HOVER_MS = 450
/** With refusalSeconds at 1, the Socket line ends about 0.6 s after its 0.8 s sample window. */
const LINE_END_MS = 800
const COOLDOWN_SECONDS = 2
/** Below the flash value and above the near value, so a repeated flash cannot hide here. */
const NO_FLASH_ALPHA = 0.7
/** Longer than the 350 ms dwell, so a warning that was going to fire has fired. */
const HELD_WINDOW_MS = 900
/** About 1.9 degrees at the working distance, so the ray counts as moved. */
const HELD_RAY_MOVE_CM = 3
/** The cage alpha must rise at least this far above its idle value. */
const MIN_WARNING_RISE = 0.5
/** Covers the 600 ms hold after a 350 ms dwell, with frame margin. */
const RST_WARNING_WINDOW_MS = 1200

/** A label that is on must not overlap the line. A label the line hid counts as clear, and returns when the line ends. */
function expectLineClearOfLabels(labels: string[]): string[] {
  const line = main().refusalLine
  const size = new vec2(line.widthCm, line.heightCm)
  const hidden: string[] = []
  must(isEnabled("RefusalLine"), "RefusalLine is off, so the overlap check would prove nothing")
  for (const name of labels) {
    if (!isEnabled(name)) {
      hidden.push(name)
      continue
    }
    const label = name === "StepLabel" ? main().stepLabel : main().stepLabel2
    expectPanelsApart("RefusalLine", name, size, new vec2(label.widthCm, label.heightCm))
  }
  print("[ClearCmosLeaf] step " + Step[currentStep()] + " labels hidden by the line: " + (hidden.join(",") || "none"))
  must(hidden.length === labels.length, "the line left " + (labels.length - hidden.length) + " step labels on")
  return hidden
}

@component
export class ClearCmosS7EarlyWarning extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    // stopAt Warned ends the run with the RST warning held on screen, so the Preview keeps that frame for a capture.
    const stopAt = config ? config.get("stopAt") : undefined
    const interactor = new ClearCmosLeafInteractor()
    await interactor.reachAnchorDone()
    expectStep(Step.PowerCord)
    must(!isEnabled("RefusalLine"), "RefusalLine is on before any reach")
    main().refusalSeconds = 1
    const startCount = earlyWarningCount()
    const startTicks = sfxCount("warning_tick")

    // Control: a brief pass through the box is not a warning.
    await interactor.hoverPart("MemoryStick", SHORT_HOVER_MS)
    await settle(100)
    must(earlyWarningCount() === startCount, "a " + SHORT_HOVER_MS + " ms hover played a warning")
    must(!isEnabled("RefusalLine"), "RefusalLine came on after a " + SHORT_HOVER_MS + " ms hover")

    // The filled box is off at rest, so the warning is clearly stronger than the idle state.
    const idleAlpha = noGoAlpha("MemoryStick")
    must(noGoFillAlpha("MemoryStick") === 0, "the MemoryStick warning fill is on before any reach")
    const warnStart = getTime()
    const sample = sampleEarlyWarning("MemoryStick", FIRST_WINDOW_MS)
    await interactor.hoverPart("MemoryStick", WARNING_HOVER_MS)
    const first = await sample
    expectEarlyWarningFlash("MemoryStick", first)
    print("[ClearCmosLeaf] MemoryStick idle alpha " + idleAlpha.toFixed(3) + " warning peak " + first.maxAlpha.toFixed(3) + " fill peak " + first.maxFillAlpha.toFixed(3))
    must(first.maxAlpha - idleAlpha >= MIN_WARNING_RISE, "the warning alpha rose only " + (first.maxAlpha - idleAlpha).toFixed(3) + " above idle " + idleAlpha.toFixed(3))
    expectWarningHold("MemoryStick", first)
    must(first.lineFirstOn >= 0.3, "the line came on after only " + first.lineFirstOn.toFixed(3) + " s")
    must(first.lineSeconds >= 0.6, "the line stayed on only " + first.lineSeconds.toFixed(3) + " s")
    must(earlyWarningCount() === startCount + 1, "expected one warning, count is " + (earlyWarningCount() - startCount))
    must(sfxCount("warning_tick") === startTicks + 1, "expected one warning_tick, count is " + (sfxCount("warning_tick") - startTicks))
    expectStep(Step.PowerCord)
    expectRefused("MemoryStick", WARNING_LINE)
    expectRefusalLineInView("MemoryStick")
    expectLineClearOfLabels(["StepLabel"])

    // A second reach inside the cooldown plays nothing.
    const repeatSample = sampleEarlyWarning("MemoryStick", REPEAT_HOVER_MS + 100)
    await interactor.hoverPart("MemoryStick", REPEAT_HOVER_MS)
    const repeat = await repeatSample
    print("[ClearCmosLeaf] repeat hover ended " + (getTime() - warnStart).toFixed(3) + " s after the first warning began, peak alpha " + repeat.maxAlpha.toFixed(3))
    must(getTime() - warnStart < COOLDOWN_SECONDS + 0.35, "the repeat hover ran past the cooldown, so it proves nothing")
    must(earlyWarningCount() === startCount + 1, "the warning repeated inside the 2 s cooldown")
    must(sfxCount("warning_tick") === startTicks + 1, "warning_tick repeated inside the 2 s cooldown")
    must(repeat.maxAlpha < NO_FLASH_ALPHA, "the box flashed again inside the cooldown, alpha " + repeat.maxAlpha.toFixed(3))

    // The cooldown belongs to one box: the socket warns while the memory is still cooling down.
    const socketStart = getTime()
    const socketSample = sampleEarlyWarning("Socket", WARNING_HOVER_MS + 300)
    await interactor.hoverPart("Socket", WARNING_HOVER_MS)
    const socket = await socketSample
    expectEarlyWarningFlash("Socket", socket)
    const socketWarnedAt = socketStart + socket.lineFirstOn - warnStart
    print("[ClearCmosLeaf] Socket warned " + socketWarnedAt.toFixed(3) + " s after the first memory reach began")
    must(socketWarnedAt < COOLDOWN_SECONDS + 0.35, "the Socket warned after the memory cooldown, so it proves nothing about per-box cooldowns")
    must(earlyWarningCount() === startCount + 2, "the Socket box did not warn on its own cooldown")
    expectStep(Step.PowerCord)
    expectRefused("Socket", WARNING_LINE)
    expectRefusalLineInView("Socket")
    expectLineClearOfLabels(["StepLabel"])

    // When the line ends, the instruction comes back with its own text.
    await settle(LINE_END_MS)
    must(!isEnabled("RefusalLine"), "RefusalLine is still on after refusalSeconds")
    expectLabel("StepLabel", "PowerCord", "Unplug the power cord")

    // The cooldown ends: the same reach warns again, so the check above measured the cooldown.
    const remainingMs = (COOLDOWN_SECONDS + 0.5 - (getTime() - warnStart)) * 1000
    if (remainingMs > 0) await settle(remainingMs)
    must(noGoAlpha("MemoryStick") < NO_FLASH_ALPHA, "MemoryStick box is still flashing before the third reach")
    const thirdSample = sampleEarlyWarning("MemoryStick", WARNING_HOVER_MS + 300)
    await interactor.hoverPart("MemoryStick", WARNING_HOVER_MS)
    expectEarlyWarningFlash("MemoryStick", await thirdSample)
    must(earlyWarningCount() === startCount + 3, "the warning did not return after the cooldown")
    expectRefused("MemoryStick", WARNING_LINE)

    // The line also stays clear of both labels at the fix, the busiest step.
    await liftAndCheck(interactor, "PowerCord", Step.Glass)
    // The Glass is the target, so the Socket under the same ray stays silent.
    const coverCount = earlyWarningCount()
    await interactor.restOnCover("Glass", part("Socket").targetWorldPosition, WARNING_HOVER_MS + 300)
    must(earlyWarningCount() === coverCount, "the Socket warned through the Glass, count rose by " + (earlyWarningCount() - coverCount))
    must(!isEnabled("RefusalLine"), "RefusalLine came on for a cursor resting on the Glass")
    await liftAndCheck(interactor, "Glass", Step.Fix)
    await settle(AFTER_STEP_MS)
    if (stopAt === "Warned") {
      main().refusalSeconds = 20
      await interactor.hoverPart("RstJumper", WARNING_HOVER_MS)
      part("RstJumper").playWarningFlash(20)
      return
    }
    for (const decoy of ["MemoryStick", "Socket", "BatteryRedPart"]) {
      const count = earlyWarningCount()
      await interactor.hoverPart(decoy, WARNING_HOVER_MS)
      await settle(50)
      must(earlyWarningCount() === count + 1, decoy + " did not warn at step Fix")
      expectStep(Step.Fix)
      expectRefusalLineInView(decoy)
      expectLineClearOfLabels(["StepLabel", "StepLabel2"])
    }

    // Fix 1: the filmed wrong reach gets the same filled flash, held for the full line time.
    const rstBefore = earlyWarningCount()
    const rstSample = sampleEarlyWarning("RstJumper", RST_WARNING_WINDOW_MS)
    await interactor.hoverPart("RstJumper", WARNING_HOVER_MS)
    const rstFlash = await rstSample
    must(earlyWarningCount() === rstBefore + 1, "RstJumper did not warn at step Fix")
    expectEarlyWarningFlash("RstJumper", rstFlash)
    expectWarningHold("RstJumper", rstFlash)
    expectStep(Step.Fix)

    // The card lifts out from under a cursor that stays put: the Socket under the same ray must not warn until the ray moves.
    await settle(COOLDOWN_SECONDS * 1000 + 300)
    must(!isEnabled("RefusalLine"), "RefusalLine is still on before the held-cursor case")
    const heldCount = earlyWarningCount()
    const heldTicks = sfxCount("warning_tick")
    const gpuHome = worldPosition("GPU")
    await interactor.pinchAndHold("GPU", "Socket", part("Socket").targetWorldPosition)
    await settle(HELD_WINDOW_MS)
    must(worldPosition("GPU").distance(gpuHome) > 1, "the GPU did not lift, so the held cursor proved nothing")
    expectStep(Step.Fix)
    must(earlyWarningCount() === heldCount, "a held cursor over Socket warned after the card lifted, count rose by " + (earlyWarningCount() - heldCount))
    must(sfxCount("warning_tick") === heldTicks, "a held cursor over Socket played warning_tick after the card lifted")
    must(!isEnabled("RefusalLine"), "RefusalLine came on for a held cursor after the card lifted")

    // Control: the same cursor, once it moves, starts the dwell. So the silence above was the guard, not a dead box.
    interactor.moveHeldRayBy(new vec3(HELD_RAY_MOVE_CM, 0, 0))
    await settle(WARNING_HOVER_MS + 100)
    must(earlyWarningCount() === heldCount + 1, "the Socket did not warn after the held ray moved, count rose by " + (earlyWarningCount() - heldCount))
    await interactor.releaseHeld()
  }
}
