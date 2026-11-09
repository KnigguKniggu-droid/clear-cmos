// LeafIndex.ts
// Owns: registration of the Clear CMOS LEAF scenarios.

import { scenariosIndex } from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import { ScenarioMetadata } from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import { ClearCmosS1Start } from "./ClearCmosS1Start"
import { ClearCmosS2Anchor } from "./ClearCmosS2Anchor"
import { ClearCmosS3Order } from "./ClearCmosS3Order"
import { ClearCmosS4Refusal } from "./ClearCmosS4Refusal"
import { ClearCmosS5aJumper } from "./ClearCmosS5aJumper"
import { ClearCmosS5bBattery } from "./ClearCmosS5bBattery"
import { ClearCmosS6Band } from "./ClearCmosS6Band"
import { ClearCmosS7EarlyWarning } from "./ClearCmosS7EarlyWarning"
import { ClearCmosS8Rst } from "./ClearCmosS8Rst"
import { ClearCmosS9Sound } from "./ClearCmosS9Sound"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    { id: "s1-start", typename: ClearCmosS1Start.getTypeName() },
    { id: "s2-anchor", typename: ClearCmosS2Anchor.getTypeName() },
    { id: "s3-order", typename: ClearCmosS3Order.getTypeName() },
    { id: "s4-refusal", typename: ClearCmosS4Refusal.getTypeName() },
    { id: "s5a-jumper", typename: ClearCmosS5aJumper.getTypeName() },
    { id: "s5b-battery", typename: ClearCmosS5bBattery.getTypeName() },
    { id: "s6-band", typename: ClearCmosS6Band.getTypeName(), parameters: { stopAt: "none", waitSeconds: "1", contactHold: "0" } },
    { id: "s7-early-warning", typename: ClearCmosS7EarlyWarning.getTypeName(), parameters: { stopAt: "none" } },
    { id: "s8-rst", typename: ClearCmosS8Rst.getTypeName(), parameters: { stopAt: "none" } },
    { id: "s9-sound", typename: ClearCmosS9Sound.getTypeName() },
  ]
}
