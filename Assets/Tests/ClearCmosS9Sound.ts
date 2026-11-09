// Build priority 8: each sound plays once, at the moment art/sfx/README.md names, along the whole jumper route.
// Fails if a sound is missing, repeated, or out of order, if the jumper sound plays before the touch,
// or if the calm note during the first-boot hold plays a sound.
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { Step } from "../Scripts/ClearCmosFlow"
import {
  AFTER_STEP_MS,
  ClearCmosLeafInteractor,
  expectStep,
  liftAndCheck,
  main,
  must,
  sampleSoundAfterStep,
  settle,
  sfxLog,
} from "./ClearCmosTestSupport"

/** The README moment for the jumper sound is the touch, which is the end of the 0.35 s approach. */
const CONTACT_SECONDS = 0.35
const CONTACT_TOLERANCE_SECONDS = 0.15

function expectLog(expected: string[]): void {
  const got = sfxLog().join(",")
  must(got === expected.join(","), "sounds played were [" + got + "], expected [" + expected.join(",") + "]")
}

@component
export class ClearCmosS9Sound extends Scenario {
  async run(): Promise<void> {
    main().waitSeconds = 3
    main().trainingSeconds = 2
    main().refusalSeconds = 1
    const interactor = new ClearCmosLeafInteractor()
    await settle(1500)
    expectLog([])

    await interactor.pinch("SymptomButton")
    await settle(300)
    expectStep(Step.Anchor)
    const played = ["step_confirm"]
    expectLog(played)

    // The scan plays its own two sounds, and not the confirm sound.
    await interactor.pinch("AnchorButton")
    await settle(AFTER_STEP_MS)
    expectStep(Step.PowerCord)
    played.push("ribbon_draw", "xray_sweep", "chime")
    expectLog(played)

    // A rest in a no-go box warns before any pinch.
    await interactor.hoverPart("MemoryStick", 500)
    await settle(100)
    played.push("warning_tick")
    expectLog(played)

    // A refused pinch thuds, and the step stays.
    await interactor.pinch("Glass")
    await settle(1200)
    expectStep(Step.PowerCord)
    played.push("refusal_thud")
    expectLog(played)

    await liftAndCheck(interactor, "PowerCord", Step.Glass)
    played.push("step_confirm")
    expectLog(played)
    await liftAndCheck(interactor, "Glass", Step.Fix)
    played.push("step_confirm")
    expectLog(played)

    // The jumper sound waits for the touch.
    const contact = sampleSoundAfterStep("jumper_contact", Step.Fix, 1500)
    await interactor.pinch("Jumper")
    const touch = await contact
    print("[ClearCmosLeaf] jumper_contact " + touch.toFixed(3) + " s after the step left Fix")
    must(touch >= 0, "jumper_contact never played after the pinch")
    must(Math.abs(touch - CONTACT_SECONDS) < CONTACT_TOLERANCE_SECONDS, "jumper_contact played " + touch.toFixed(3) + " s after the pinch, expected about " + CONTACT_SECONDS)
    played.push("jumper_contact")
    expectLog(played)

    // The wait ends on its own, in silence.
    await settle(3400)
    expectStep(Step.Rebuild)
    expectLog(played)

    await interactor.pinch("PowerButton")
    await settle(1200)
    expectStep(Step.Rebuild)
    played.push("refusal_thud")
    expectLog(played)

    await interactor.pinch("RebuildButton")
    await settle(1200)
    expectStep(Step.PowerOn)
    played.push("step_confirm")
    expectLog(played)

    await interactor.pinch("PowerButton")
    await settle(300)
    expectStep(Step.Training)
    played.push("step_confirm")
    expectLog(played)

    // The second pinch during the hold is a calm note with no sound.
    await interactor.pinch("PowerButton")
    await settle(100)
    expectStep(Step.Training)
    expectLog(played)

    await settle(2500)
    expectStep(Step.Done)
    played.push("boot_ring")
    expectLog(played)
  }
}
