// Council section 1: the RST pins sit about 2 cm from CLR_CMOS. At the fix, a pinch on RST is refused
// with its own line, the step does not change, and the CLR_CMOS pins still finish the fix.
// Fails if RST is not refused, if the step moves, or if the two targets are not separated in the 3x callout.
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario"
import { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig"
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils"
import { Step } from "../Scripts/ClearCmosFlow"
import {
  AFTER_STEP_MS,
  ClearCmosLeafInteractor,
  expectPartWinsRay,
  expectRefusalLineInView,
  expectRefusalMotion,
  expectRefused,
  expectRings,
  expectStep,
  isEnabled,
  liftAndCheck,
  main,
  must,
  noGoAlpha,
  noGoEnabled,
  noGoFillAlpha,
  noGoWallHeightCm,
  part,
  sampleEarlyWarning,
  sampleRefusal,
  settle,
  worldPosition,
} from "./ClearCmosTestSupport"

const RST_LINE = "RST restarts. Use CLR_CMOS."
/** The lane below the board, as a literal so the check does not ask ClearCmosMain. */
const BELOW_BOARD_UP_CM = -16
/** The minimum target size and gap in the brief, in cm. */
const MIN_TARGET_CM = 3
const MIN_GAP_CM = 1.5
/** The two amber callout boxes must not touch, on either axis, so a viewer can tell them apart. */
const MIN_CALLOUT_BOX_GAP_CM = 0.7
const RST_REST_ALPHA = 0.45
/** #FF3D4A, the Danger color. */
const DANGER_RGB = new vec3(1, 0.239, 0.29)
/** #FFC14D, the X-ray amber of hidden parts. CLR_CMOS holds it only before the fix. */
const AMBER_RGB = new vec3(1, 0.757, 0.302)
/** #2EF2B8, the Lens safe green of the right pins at the fix. */
const SAFE_RGB = new vec3(0.18, 0.949, 0.722)
/** The card silkscreen stays faint at the fix, so the pins lead. */
const GPU_LABEL_QUIET_MAX_ALPHA = 0.4
/** Fill alpha the warning and the refusal must reach on the RST box. */
const RST_FILL_ALPHA = 0.4
/** The warning hold (600 ms) plus its decay (250 ms). */
const RST_FILL_DECAY_MS = 1000
const COLOR_TOLERANCE = 0.02
/** Sum of the channel differences. Red against amber differ by about 0.52 on green alone. */
const MIN_COLOR_DIFFERENCE = 0.4
/** Other decoy boxes stay faint, so only the wrong pins stand out at the fix. */
const OTHER_BOX_MAX_ALPHA = 0.25

function baseRgb(name: string): vec3 {
  const color = (findSceneObjectByName(name).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor
  return new vec3(color.r, color.g, color.b)
}

function colorDifference(a: vec3, b: vec3): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)
}

/** Enabled Text objects with this exact string, anywhere in the scene. */
function countEnabledText(text: string): number {
  let count = 0
  const visit = (o: SceneObject): void => {
    const t = o.getComponent("Component.Text") as Text
    if (t && o.isEnabledInHierarchy && t.text === text) count++
    o.children.forEach(visit)
  }
  for (let i = 0; i < global.scene.getRootObjectsCount(); i++) visit(global.scene.getRootObject(i))
  return count
}

@component
export class ClearCmosS8Rst extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    // stopAt ends the run with the refusal still on screen, so the Preview keeps that frame for a capture.
    const stopAt = config ? config.get("stopAt") : undefined
    if (stopAt === "Refused") main().refusalSeconds = 20
    const interactor = new ClearCmosLeafInteractor()
    await interactor.reachAnchorDone()

    // Council: its no-go box is armed only at the fix.
    must(!noGoEnabled("RstJumper"), "RstJumper no-go box is on before the fix")
    // Audit: before the fix, CLR_CMOS keeps the amber of hidden parts, and only the fix turns it green.
    must(colorDifference(baseRgb("XRayCallout"), AMBER_RGB) < COLOR_TOLERANCE, "the CLR_CMOS callout is " + baseRgb("XRayCallout").toString() + " before the fix, expected amber")

    await liftAndCheck(interactor, "PowerCord", Step.Glass)
    must(!noGoEnabled("RstJumper"), "RstJumper no-go box came on at the Glass step")
    await liftAndCheck(interactor, "Glass", Step.Fix)
    must(noGoEnabled("RstJumper"), "RstJumper no-go box is off at the fix")
    expectRings(["Jumper"])

    // U3: the wrong pins read as wrong at rest, and only they do.
    const restAlpha = noGoAlpha("RstJumper")
    print("[ClearCmosLeaf] RstJumper no-go alpha at rest " + restAlpha.toFixed(3))
    must(restAlpha >= RST_REST_ALPHA, "RstJumper rests at no-go alpha " + restAlpha.toFixed(3) + ", expected at least " + RST_REST_ALPHA)
    must(noGoAlpha("Socket") <= OTHER_BOX_MAX_ALPHA, "Socket no-go alpha is " + noGoAlpha("Socket").toFixed(3) + " at rest, so RST does not stand out")

    // The two real headers are about 2 cm apart, as printed on manual p.4.
    const jumper = part("Jumper")
    const rst = part("RstJumper")
    const headerGap = jumper.getTransform().getLocalPosition().distance(rst.getTransform().getLocalPosition())
    print("[ClearCmosLeaf] CLR_CMOS to RST header distance " + headerGap.toFixed(2) + " cm")
    must(headerGap > 1.7 && headerGap < 2.4, "the headers are " + headerGap.toFixed(2) + " cm apart, expected about 2 cm")

    // The pinch targets are 3x further apart, in the callout, so each can be a 3 cm target.
    const targetGap = jumper.targetWorldPosition.distance(rst.targetWorldPosition)
    print("[ClearCmosLeaf] callout target distance " + targetGap.toFixed(2) + " cm, ratio " + (targetGap / headerGap).toFixed(2))
    must(Math.abs(targetGap / headerGap - 3) < 0.2, "the callout targets are " + (targetGap / headerGap).toFixed(2) + "x the header distance")
    for (const p of [jumper, rst]) {
      must(p.colliderSize.x >= MIN_TARGET_CM && p.colliderSize.z >= MIN_TARGET_CM, p.getSceneObject().name + " target is smaller than 3 cm")
    }
    const rig = findSceneObjectByName("Rig").getTransform().getInvertedWorldTransform()
    const a = rig.multiplyPoint(jumper.targetWorldPosition)
    const b = rig.multiplyPoint(rst.targetWorldPosition)
    const gapX = Math.abs(a.x - b.x) - (jumper.colliderSize.x + rst.colliderSize.x) / 2
    const gapZ = Math.abs(a.z - b.z) - (jumper.colliderSize.z + rst.colliderSize.z) / 2
    must(Math.max(gapX, gapZ) >= MIN_GAP_CM, "the callout targets are only " + Math.max(gapX, gapZ).toFixed(2) + " cm apart")

    // The amber boxes are measured from the callout mesh, not from the constants that built it.
    const callout = findSceneObjectByName("XRayCallout")
    const calloutVisual = callout.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const rstCallout = findSceneObjectByName("XRayCalloutRst")
    const rstCalloutVisual = rstCallout.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    const calloutScale = callout.getTransform().getLocalScale().x
    must(rstCallout.getTransform().getLocalScale().x === calloutScale, "the two callout meshes have different scales")
    // CLR_CMOS is the box toward -x and -z, RST toward +x and +z. A built mesh reports bounds that include its origin, so only each outer edge is real.
    const calloutPosition = callout.getTransform().getLocalPosition()
    const toMesh = (p: vec3): vec3 => p.sub(calloutPosition).uniformScale(1 / calloutScale)
    const aMesh = toMesh(a)
    const bMesh = toMesh(b)
    const clrMin = calloutVisual.mesh.aabbMin
    const rstMax = rstCalloutVisual.mesh.aabbMax
    const boxGapX = (bMesh.x - aMesh.x - (aMesh.x - clrMin.x) - (rstMax.x - bMesh.x)) * calloutScale
    const boxGapZ = (bMesh.z - aMesh.z - (aMesh.z - clrMin.z) - (rstMax.z - bMesh.z)) * calloutScale
    print("[ClearCmosLeaf] callout box gap x " + boxGapX.toFixed(2) + " z " + boxGapZ.toFixed(2) + " cm")
    must(boxGapX >= MIN_CALLOUT_BOX_GAP_CM && boxGapZ >= MIN_CALLOUT_BOX_GAP_CM, "the amber callout boxes have a gap of only x " + boxGapX.toFixed(2) + ", z " + boxGapZ.toFixed(2) + " cm")

    // Audit: at the fix, right and wrong differ at a glance. CLR_CMOS and its real pins are the safe green, and amber stays on hidden parts.
    const clrColor = baseRgb("XRayCallout")
    const rstColor = baseRgb("XRayCalloutRst")
    print("[ClearCmosLeaf] callout colors CLR_CMOS " + clrColor.toString() + " RST " + rstColor.toString())
    must(colorDifference(rstColor, clrColor) >= MIN_COLOR_DIFFERENCE, "the RST callout color " + rstColor.toString() + " is too close to the Jumper callout color " + clrColor.toString())
    must(colorDifference(rstColor, DANGER_RGB) < COLOR_TOLERANCE, "the RST callout color is " + rstColor.toString() + ", expected Danger #FF3D4A")
    must(colorDifference(clrColor, SAFE_RGB) < COLOR_TOLERANCE, "the CLR_CMOS callout color is " + clrColor.toString() + ", expected safe green #2EF2B8")
    must(colorDifference(baseRgb("XRayJumper"), SAFE_RGB) < COLOR_TOLERANCE, "the XRayJumper cage is " + baseRgb("XRayJumper").toString() + ", expected safe green #2EF2B8")
    must(colorDifference(baseRgb("XRayBattery"), AMBER_RGB) < COLOR_TOLERANCE, "the XRayBattery mark is " + baseRgb("XRayBattery").toString() + ", expected amber: the battery is hidden")
    const gpuLabel = findSceneObjectByName("GPU").children.find((c) => c.name === "Label")
    must(!!gpuLabel && gpuLabel.isEnabledInHierarchy, "the GPU Label is off at the fix, expected quiet, not hidden")
    const gpuLabelAlpha = (gpuLabel.getComponent("Component.Text") as Text).textFill.color.a as number
    print("[ClearCmosLeaf] GPU label alpha at the fix " + gpuLabelAlpha.toFixed(2))
    must(gpuLabelAlpha <= GPU_LABEL_QUIET_MAX_ALPHA, "the GPU Label alpha is " + gpuLabelAlpha.toFixed(2) + " at the fix, expected at most " + GPU_LABEL_QUIET_MAX_ALPHA)
    const rstBoxColor = (rst.getSceneObject().children.find((c) => c.name === "NoGoBox").getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor
    must(colorDifference(new vec3(rstBoxColor.r, rstBoxColor.g, rstBoxColor.b), DANGER_RGB) < COLOR_TOLERANCE, "the RST no-go box color is not Danger #FF3D4A")
    const clrThickness = calloutVisual.mesh.aabbMax.y - calloutVisual.mesh.aabbMin.y
    const rstThickness = rstCalloutVisual.mesh.aabbMax.y - rstCalloutVisual.mesh.aabbMin.y
    print("[ClearCmosLeaf] callout mesh thickness CLR_CMOS " + clrThickness.toFixed(3) + " RST " + rstThickness.toFixed(3))
    // Audit: at rest the wrong pins are a thin outline, so the fill below is a visible change at the part.
    must(rstThickness <= clrThickness, "the RST callout is heavier than the CLR_CMOS callout: mesh thickness " + rstThickness.toFixed(3) + " against " + clrThickness.toFixed(3))
    must(rst.noGoBarCm <= part("Socket").noGoBarCm, "the RST no-go box bar is " + rst.noGoBarCm + " cm, expected a thin outline no thicker than the Socket bar")
    must(noGoFillAlpha("RstJumper") === 0, "the RST box is filled at rest, alpha " + noGoFillAlpha("RstJumper").toFixed(2))

    // The green ring is the next-step signal, so it must draw over the amber callout.
    const jumperRing = jumper.getSceneObject().children.find((c) => c.name === "Ring")
    must(!!jumperRing, "Jumper has no Ring child")
    const ringVisual = jumperRing.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    must(ringVisual.getRenderOrder() > calloutVisual.getRenderOrder(), "the Jumper ring draws at " + ringVisual.getRenderOrder() + ", under the callout at " + calloutVisual.getRenderOrder())
    must(!ringVisual.mainMaterial.mainPass.depthTest, "the Jumper ring is depth tested, so the callout hides it")

    // One name per pair: the callout labels. The art's CLR_CMOS under the callout is masked while the callout is on.
    must(isEnabled("SilkscreenMask"), "SilkscreenMask is off at the fix, so the art CLR_CMOS shows under the callout")
    must(countEnabledText("CLR_CMOS") === 1, "there are " + countEnabledText("CLR_CMOS") + " CLR_CMOS labels on, expected 1")
    must(countEnabledText("RST") === 1, "there are " + countEnabledText("RST") + " RST labels on, expected 1")

    // Real SIK aiming, not only the forced LEAF target.
    await expectPartWinsRay("RstJumper")
    await expectPartWinsRay("Jumper")
    const rstLabel = rst.getSceneObject().children.find((c) => c.name === "Label")
    must(!!rstLabel && rstLabel.isEnabledInHierarchy, "RstJumper Label is not on under the X-ray")
    const rstText = rstLabel.getComponent("Component.Text").text
    must(rstText === "RST", 'RstJumper Label says "' + rstText + '"')

    // The warning is the visible change at the part: the outline fills, then returns to an outline.
    const warnSample = sampleEarlyWarning("RstJumper", 1300)
    await interactor.hoverPart("RstJumper", 500)
    const warned = await warnSample
    print("[ClearCmosLeaf] RST warning fill peak " + warned.maxFillAlpha.toFixed(2) + " held " + warned.fillHoldSeconds.toFixed(2))
    must(warned.maxFillAlpha >= RST_FILL_ALPHA, "the RST box did not fill during the early warning, peak " + warned.maxFillAlpha.toFixed(2))
    await settle(RST_FILL_DECAY_MS)
    must(noGoFillAlpha("RstJumper") === 0, "the RST fill stayed on after the warning, alpha " + noGoFillAlpha("RstJumper").toFixed(2))
    must(noGoWallHeightCm("RstJumper") === 0, "the RST wall stayed up after the warning, height " + noGoWallHeightCm("RstJumper").toFixed(2))

    // The wrong reach: refused with the exact line, no step change, the RST pins stay where they are. The refusal fills the box too.
    const before = worldPosition("RstJumper")
    const refusalSample = sampleRefusal("RstJumper", 1500)
    await interactor.pinch("RstJumper")
    const refusal = await refusalSample
    expectRefusalMotion("RstJumper", refusal)
    print("[ClearCmosLeaf] RST refusal fill peak " + refusal.maxFillAlpha.toFixed(2))
    must(refusal.maxFillAlpha >= RST_FILL_ALPHA, "the RST box did not fill during the refusal, peak " + refusal.maxFillAlpha.toFixed(2))
    must(refusal.maxWallCm === 0, "the RST refusal raised the warning wall, peak " + refusal.maxWallCm.toFixed(2) + " cm")
    expectStep(Step.Fix)
    expectRefused("RstJumper", RST_LINE)
    must(isEnabled("RefusalLine"), "RefusalLine is off after the RST pinch")
    expectRefusalLineInView("RstJumper", BELOW_BOARD_UP_CM)
    must(worldPosition("RstJumper").distance(before) < 0.01, "RstJumper moved")
    expectRings(["Jumper"])
    if (stopAt === "Refused") return

    // Control: the same interactor on the right pins finishes the fix, so the refusal above was not a dead trigger.
    await settle(main().refusalSeconds * 1000 + 300)
    await interactor.pinch("Jumper")
    await settle(AFTER_STEP_MS)
    expectStep(Step.Wait)
  }
}
