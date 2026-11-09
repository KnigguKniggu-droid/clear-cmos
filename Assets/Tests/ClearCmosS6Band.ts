// Done criterion 6, automated part: every next-step panel projects inside the display band at the working view.
// Parameter stopAt ends the run at the named Step so the Preview keeps that frame for a capture.
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import { Step } from "../Scripts/ClearCmosFlow"
import {
  AFTER_STEP_MS,
  ClearCmosLeafInteractor,
  PART_VISUALS,
  expectBandAtStep,
  expectPanelClearOfParts,
  expectPanelInBand,
  expectPanelTextFits,
  expectPanelsApart,
  expectStep,
  isEnabled,
  main,
  must,
  settle,
} from "./ClearCmosTestSupport"

function expectClearAtStep(names: string[]): void {
  const m = main()
  const sizes: { [name: string]: vec2 } = {
    StepLabel: new vec2(m.stepLabel.widthCm, m.stepLabel.heightCm),
    StepLabel2: new vec2(m.stepLabel2.widthCm, m.stepLabel2.heightCm),
    WaitCard: new vec2(m.waitCard.widthCm, m.waitCard.heightCm),
    RebuildButton: new vec2(m.rebuildButton.widthCm, m.rebuildButton.heightCm),
    SymptomLabel: new vec2(m.symptomLabel.widthCm, m.symptomLabel.heightCm),
  }
  for (const name of names) expectPanelClearOfParts(name, sizes[name], PART_VISUALS)
}

@component
export class ClearCmosS6Band extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const stopAt = config ? config.get("stopAt") : undefined
    const seconds = config ? config.getNumber("waitSeconds") : undefined
    main().waitSeconds = seconds !== undefined ? seconds : 1
    // A capture of the contact raises both, so the tool and the flash stay on screen.
    const contactHold = config ? config.getNumber("contactHold") : undefined
    if (contactHold !== undefined && contactHold > 0) {
      main().screwdriverHoldSeconds = contactHold
      main().padFlashSeconds = contactHold
    }
    const interactor = new ClearCmosLeafInteractor()
    await interactor.reachAnchorDone()

    expectStep(Step.PowerCord)
    expectBandAtStep(["StepLabel"])
    expectClearAtStep(["StepLabel"])
    if (stopAt === "PowerCord") return

    await interactor.pinch("PowerCord")
    await settle(AFTER_STEP_MS)
    expectStep(Step.Glass)
    expectBandAtStep(["StepLabel"])
    expectClearAtStep(["StepLabel"])
    if (stopAt === "Glass") return

    await interactor.pinch("Glass")
    await settle(AFTER_STEP_MS)
    expectStep(Step.Fix)
    expectBandAtStep(["StepLabel", "StepLabel2"])
    const one = main().stepLabel
    const two = main().stepLabel2
    expectPanelsApart("StepLabel", "StepLabel2", new vec2(one.widthCm, one.heightCm), new vec2(two.widthCm, two.heightCm))
    expectClearAtStep(["StepLabel", "StepLabel2"])
    if (stopAt === "Fix") return
    if (stopAt === "GpuLifted") {
      await interactor.liftGpu()
      return
    }

    await interactor.pinch("Jumper")
    expectStep(Step.Wait)
    expectBandAtStep(["WaitCard"])
    expectClearAtStep(["WaitCard"])
    // The amber Battery mark stays on during the contact, so the card must clear it. The X-ray must be on, or this check proves nothing.
    must(isEnabled("XRayPierce"), "XRayPierce is off at Wait, so the Battery mark check proves nothing")
    expectPanelClearOfParts("WaitCard", new vec2(main().waitCard.widthCm, main().waitCard.heightCm), ["XRayPierce"])
    if (stopAt === "Wait") return

    await settle(1500)
    expectStep(Step.Rebuild)
    expectBandAtStep(["RebuildButton"])
    expectClearAtStep(["RebuildButton"])
    if (stopAt === "Rebuild") return

    await interactor.pinch("RebuildButton")
    await settle(1200)
    expectStep(Step.PowerOn)
    expectBandAtStep(["StepLabel"])
    expectClearAtStep(["StepLabel"])
    if (stopAt === "PowerOn") return

    await interactor.pinch("PowerButton")
    await settle(300)
    expectStep(Step.Training)
    expectBandAtStep([])
    expectPanelInBand("SymptomLabel", main().symptomLabel.widthCm, main().symptomLabel.heightCm)
    expectPanelTextFits("SymptomLabel")
    expectClearAtStep(["SymptomLabel"])
    if (stopAt === "Training") return
    if (stopAt === "Done") {
      await settle((main().trainingSeconds + 1.5) * 1000)
      expectStep(Step.Done)
    }
  }
}
