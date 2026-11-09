// Done criterion 5, jumper path.
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { Step } from "../Scripts/ClearCmosFlow"
import {
  ClearCmosLeafInteractor,
  countdownWrites,
  expectContact,
  expectStep,
  expectWaitCardCopy,
  finishAfterFix,
  isEnabled,
  main,
  must,
  refusalLineSeenDuring,
  sampleContact,
  waitUntilEnabled,
} from "./ClearCmosTestSupport"

@component
export class ClearCmosS5aJumper extends Scenario {
  async run(): Promise<void> {
    // Longer than the 2.6 s contact: a shorter wait ends the contact early, at Rebuild.
    main().waitSeconds = 3
    const interactor = new ClearCmosLeafInteractor()
    await interactor.reachFix()
    expectStep(Step.Fix)

    const writesBefore = countdownWrites()
    const seen = waitUntilEnabled("WaitCard", 300)
    const contact = sampleContact(3000)
    const refusalSeen = refusalLineSeenDuring(1000)
    await interactor.pinch("Jumper")
    must(await seen, "WaitCard never turned on after Jumper")
    // B2: a second pinch on the jumper is ignored, not refused.
    await interactor.pinch("Jumper")
    expectStep(Step.Wait)
    must(!(await refusalSeen), "RefusalLine came on for a repeat pinch on the jumper")
    expectContact(await contact)
    must(!isEnabled("XRay"), "XRay stayed on after the contact ended")
    expectWaitCardCopy()

    await finishAfterFix(interactor)
    // B5: four whole-second values in a 3 s wait, not one write per frame.
    const writes = countdownWrites() - writesBefore
    print("[ClearCmosLeaf] countdown text writes " + writes)
    must(writes >= 3 && writes <= 5, "countdown text was written " + writes + " times in a 3 s wait")
  }
}
