// ClearCmosTestSupport.ts
// Owns: shared LEAF helpers for the Clear CMOS scenarios. Tests only; the Lens never imports this.
// Every interaction goes through a real SIK interactor. No flow handler is called directly.

import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { InteractionManager } from "SpectaclesInteractionKit.lspkg/Core/InteractionManager/InteractionManager"
import { InteractorTriggerType, TargetingMode } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import { findInteractablesByName } from "Leaf.lspkg/Interactors/InteractableUtils"
import { expect } from "Leaf.lspkg/Utils/common/Expect"
import { awaitEventOnce, findSceneObjectByName, nextFrame, sleep } from "Leaf.lspkg/Utils/common/Utils"
import { Step } from "../Scripts/ClearCmosFlow"
import { ClearCmosLabelUI } from "../Scripts/ClearCmosLabelUI"
import { ClearCmosMain } from "../Scripts/ClearCmosMain"
import { ClearCmosPart } from "../Scripts/ClearCmosPart"

export const PART_NAMES = [
  "PowerCord",
  "Glass",
  "GPU",
  "Jumper",
  "RstJumper",
  "Battery",
  "BatteryRedPart",
  "Socket",
  "MemoryStick",
  "PowerButton",
]

/** Longer than the 0.6 s lift and the 1 s ring fade. */
export const AFTER_STEP_MS = 1400

export function must(condition: boolean, message: string): void {
  if (!condition) print("[ClearCmosLeaf] FAILED CHECK: " + message)
  expect(condition).toBe(true)
}

export async function settle(ms: number): Promise<void> {
  await sleep(ms)
  await nextFrame()
}

export function main(): ClearCmosMain {
  return findSceneObjectByName("ClearCmosMain").getComponent(ClearCmosMain.getTypeName())
}

export function currentStep(): Step {
  return main()["step"]
}

export function expectStep(step: Step): void {
  must(currentStep() === step, "step is " + Step[currentStep()] + ", expected " + Step[step])
}

export function part(name: string): ClearCmosPart {
  return findSceneObjectByName(name).getComponent(ClearCmosPart.getTypeName())
}

export function worldPosition(name: string): vec3 {
  return findSceneObjectByName(name).getTransform().getWorldPosition()
}

/** True only when the object and all of its parents are enabled, so a hidden parent cannot pass as visible. */
export function isEnabled(name: string): boolean {
  return findSceneObjectByName(name).isEnabledInHierarchy
}

export function labelText(name: string): string {
  return findSceneObjectByName(name).getComponent(ClearCmosLabelUI.getTypeName()).textValue
}

export function monitorText(): string {
  return findSceneObjectByName("MonitorScreen").getComponent("Component.Text").text
}

function ringIsOn(name: string): boolean {
  const so = findSceneObjectByName(name)
  const ring = so.children.find((c) => c.name === "Ring")
  return !!ring && ring.enabled && part(name).ringVisible
}

/** Checks that exactly the named parts have a visible ring. */
export function expectRings(expected: string[]): void {
  for (const name of PART_NAMES) {
    const on = ringIsOn(name)
    must(on === expected.includes(name), "ring on " + name + " is " + on + ", expected rings: " + expected.join(","))
  }
}

/** Literal lane geometry from the visual punch list. The checks below do not ask ClearCmosMain where the lane is. */
const WORKING_DEPTH_CM = 85
const LANE_UP_CM = 17.5
const LANE_BAND_MARGIN_CM = 0.5
const LANE_TOLERANCE_CM = 0.6

export function rigLocal(name: string): vec3 {
  return findSceneObjectByName("Rig").getTransform().getInvertedWorldTransform().multiplyPoint(worldPosition(name))
}

/** Rig-local x of the part, clamped so a panel of this width stays in the band. */
function laneXForPart(partName: string, widthCm: number): number {
  const maxX = DISPLAY_HALF_TAN_X * WORKING_DEPTH_CM - widthCm / 2 - LANE_BAND_MARGIN_CM
  return Math.min(maxX, Math.max(-maxX, rigLocal(partName).x))
}

/** Checks that a panel sits in a lane at the expected x. The default lane is the top lane. */
export function expectInLane(name: string, expectedX: number, laneUpCm: number = LANE_UP_CM): void {
  const local = rigLocal(name)
  const up = local.dot(new vec3(0, Math.cos(WORKING_PITCH_RAD), -Math.sin(WORKING_PITCH_RAD)))
  const panel = findSceneObjectByName(name).getComponent(ClearCmosLabelUI.getTypeName()) as ClearCmosLabelUI
  // A tall panel stops short of the lane, so its top stays inside the band.
  const expectedUp = Math.min(laneUpCm, DISPLAY_HALF_TAN_Y * WORKING_DEPTH_CM - panel.heightCm / 2 - LANE_BAND_MARGIN_CM)
  must(Math.abs(up - expectedUp) < LANE_TOLERANCE_CM, name + " is " + up.toFixed(2) + " cm up the view, expected " + expectedUp.toFixed(2))
  must(Math.abs(local.x - expectedX) < LANE_TOLERANCE_CM, name + " is at x " + local.x.toFixed(2) + ", expected " + expectedX.toFixed(2))
}

/** Checks one enabled label with the expected text, in the lane above the part it describes. */
export function expectLabel(labelName: string, partName: string, text: string, fixedLaneX?: number): void {
  must(isEnabled(labelName), labelName + " is not enabled")
  must(labelText(labelName) === text, labelName + ' text is "' + labelText(labelName) + '", expected "' + text + '"')
  const label = findSceneObjectByName(labelName).getComponent(ClearCmosLabelUI.getTypeName())
  expectInLane(labelName, fixedLaneX !== undefined ? fixedLaneX : laneXForPart(partName, label.widthCm))
}

/** The no-go alpha with a test ray held gapCm off the box edge, so proximity goes through the ray distance path. */
export async function noGoAlphaForRayGap(name: string, gapCm: number): Promise<number> {
  const camera = main().cameraObject.getTransform().getWorldPosition()
  const right = findSceneObjectByName("Rig").getTransform().right
  const aim = worldPosition(name).add(right.uniformScale(part(name).noGoRadiusCm + gapCm))
  main()["testRay"] = { start: camera, direction: aim.sub(camera).normalize() }
  await nextFrame()
  await nextFrame()
  await nextFrame()
  const alpha = noGoAlpha(name)
  main()["testRay"] = null
  await nextFrame()
  return alpha
}

/** The line the early warning shows. The part's own reason appears only after a pinch. */
export const WARNING_LINES = { MemoryStick: "Stop: BIOS reset comes first.", Socket: "Stop: CPU pins bend easily." }

export function expectRefused(partName: string, expectedLine: string | null): void {
  must(isEnabled("RefusalLine"), "RefusalLine is not enabled after refusing " + partName)
  const line = labelText("RefusalLine")
  must(line.length > 0, "RefusalLine has no text")
  if (expectedLine !== null) {
    must(line.indexOf(expectedLine) >= 0, 'RefusalLine says "' + line + '", expected "' + expectedLine + '"')
  }
}

/** Display band of the Specs preview at the working view, measured from a preview capture. */
const DISPLAY_HALF_TAN_X = 0.21
const DISPLAY_HALF_TAN_Y = 0.24
const WORKING_PITCH_RAD = (35 * Math.PI) / 180

/** Checks that RefusalLine is fully in the display band and in the lane above the refused part. */
export function expectRefusalLineInView(partName: string, laneUpCm: number = LANE_UP_CM): void {
  const line = findSceneObjectByName("RefusalLine").getComponent(ClearCmosLabelUI.getTypeName())
  expectPanelInBand("RefusalLine", line.widthCm, line.heightCm)
  expectPanelTextFits("RefusalLine")
  expectInLane("RefusalLine", laneXForPart(partName, line.widthCm), laneUpCm)
  expectPanelClearOfParts("RefusalLine", new vec2(line.widthCm, line.heightCm), PART_VISUALS)
}

/** Checks each named panel is enabled and fully in the band. Other next-step panels must be off. */
export function expectBandAtStep(expected: string[]): void {
  const panels: { [name: string]: { widthCm: number; heightCm: number } } = {
    StepLabel: main().stepLabel,
    StepLabel2: main().stepLabel2,
    WaitCard: main().waitCard,
    RebuildButton: main().rebuildButton,
  }
  for (const name of Object.keys(panels)) {
    must(isEnabled(name) === expected.includes(name), name + " enabled is " + isEnabled(name) + " at step " + Step[currentStep()])
    if (expected.includes(name)) {
      expectPanelInBand(name, panels[name].widthCm, panels[name].heightCm)
      expectPanelTextFits(name)
    }
  }
}

/** Checks that one Text box stays inside the half extents of its panel, in the Text's own cm. */
function expectTextInside(owner: string, text: Text, halfW: number, halfH: number): void {
  const box = text.getBoundingBox()
  print("[ClearCmosLeaf] text " + owner + ' "' + text.text + '" box l ' + box.left.toFixed(2) + " r " + box.right.toFixed(2) + " b " + box.bottom.toFixed(2) + " t " + box.top.toFixed(2) + " halves " + halfW + " " + halfH)
  must(box.left >= -halfW && box.right <= halfW && box.bottom >= -halfH && box.top <= halfH, owner + ' text "' + text.text + '" is outside its panel')
}

function childByName(owner: SceneObject, name: string): SceneObject {
  const child = owner.children.find((c) => c.name === name)
  must(!!child, owner.name + " has no child " + name)
  return child
}

/** No text clipped: each panel's text stays inside the panel it sits on. */
export function expectPanelTextFits(name: string): void {
  const owner = findSceneObjectByName(name)
  if (name === "WaitCard") {
    const card = main().waitCard
    const rows = childByName(owner, "Content").children.filter((c) => c.name === "Row")
    must(rows.length === 3, "WaitCard has " + rows.length + " rows")
    const heights = [4, 2, 3.2]
    rows.forEach((row, i) => expectTextInside("WaitCard row " + i, row.getComponent("Component.Text"), (card.widthCm - 2) / 2, heights[i] / 2))
    return
  }
  if (name === "RebuildButton" || name === "AnchorButton") {
    const button = name === "RebuildButton" ? main().rebuildButton : main().anchorButton
    expectTextInside(name, childByName(owner, "ButtonLabel").getComponent("Component.Text"), button.widthCm / 2, button.heightCm / 2)
    return
  }
  const label = owner.getComponent(ClearCmosLabelUI.getTypeName())
  expectTextInside(name, childByName(owner, "Content").getComponent("Component.Text"), label.widthCm / 2, label.heightCm / 2)
}

const WORLD_AABB_CORNERS: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]

/** The tan rect of a mesh at the working view, from its world bounds. */
function visualRect(name: string): { minX: number; maxX: number; minY: number; maxY: number } {
  const view = workingView()
  const visual = findSceneObjectByName(name).getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  const min = visual.worldAabbMin()
  const max = visual.worldAabbMax()
  const rect = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  for (const [sx, sy, sz] of WORLD_AABB_CORNERS) {
    const corner = new vec3(sx ? max.x : min.x, sy ? max.y : min.y, sz ? max.z : min.z).sub(view.eye)
    const depth = corner.dot(view.forward)
    must(depth > 0, name + " corner is behind the camera at the working view")
    rect.minX = Math.min(rect.minX, corner.dot(view.right) / depth)
    rect.maxX = Math.max(rect.maxX, corner.dot(view.right) / depth)
    rect.minY = Math.min(rect.minY, corner.dot(view.up) / depth)
    rect.maxY = Math.max(rect.maxY, corner.dot(view.up) / depth)
  }
  return rect
}

/**
 * Panel 1 and the brief: no panel covers a part at the working view. Compares the panel rect with the
 * world-bounds rect of each visual that is on right now. Fails with the first part that overlaps.
 */
export const PART_VISUALS = ["GlassVisual", "GpuVisual", "Stick1", "Stick2", "Stick3", "Stick4", "SocketVisual", "DramLed", "JumperVisual", "RstJumperVisual", "BatteryVisual", "PowerButtonVisual"]

export function expectPanelClearOfParts(panelName: string, size: vec2, visuals: string[]): void {
  const panel = panelRect(panelName, size)
  for (const name of visuals) {
    if (!isEnabled(name)) continue
    const part = visualRect(name)
    const apart = panel.maxX <= part.minX || part.maxX <= panel.minX || panel.maxY <= part.minY || part.maxY <= panel.minY
    print("[ClearCmosLeaf] " + panelName + " bottom " + panel.minY.toFixed(3) + " vs " + name + " top " + part.maxY.toFixed(3) + " at step " + Step[currentStep()])
    must(apart, panelName + " overlaps " + name + " at the working view: panel y " + panel.minY.toFixed(3) + " to " + panel.maxY.toFixed(3) + ", part y " + part.minY.toFixed(3) + " to " + part.maxY.toFixed(3) + ", panel x " + panel.minX.toFixed(3) + " to " + panel.maxX.toFixed(3) + ", part x " + part.minX.toFixed(3) + " to " + part.maxX.toFixed(3))
  }
}

/** Checks that two viewer-facing panels do not overlap as seen from the working view. */
export function expectPanelsApart(nameA: string, nameB: string, sizeA: vec2, sizeB: vec2): void {
  const a = panelRect(nameA, sizeA)
  const b = panelRect(nameB, sizeB)
  const apart = a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY
  must(apart, nameA + " overlaps " + nameB + " at the working view")
}

function workingView(): { eye: vec3; right: vec3; up: vec3; forward: vec3 } {
  const yaw = findSceneObjectByName("Rig").getTransform().getWorldRotation()
  return {
    eye: findSceneObjectByName("Camera Object").getTransform().getWorldPosition(),
    right: yaw.multiplyVec3(new vec3(1, 0, 0)),
    up: yaw.multiplyVec3(new vec3(0, Math.cos(WORKING_PITCH_RAD), -Math.sin(WORKING_PITCH_RAD))),
    forward: yaw.multiplyVec3(new vec3(0, -Math.sin(WORKING_PITCH_RAD), -Math.cos(WORKING_PITCH_RAD))),
  }
}

function panelRect(name: string, size: vec2): { minX: number; maxX: number; minY: number; maxY: number } {
  const view = workingView()
  const t = findSceneObjectByName(name).getTransform()
  const center = t.getWorldPosition()
  const halfRight = t.right.uniformScale(size.x / 2)
  const halfUp = t.up.uniformScale(size.y / 2)
  const rect = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const corner = center.add(halfRight.uniformScale(sx)).add(halfUp.uniformScale(sy)).sub(view.eye)
      const depth = corner.dot(view.forward)
      must(depth > 0, name + " corner is behind the camera at the working view")
      const x = corner.dot(view.right) / depth
      const y = corner.dot(view.up) / depth
      rect.minX = Math.min(rect.minX, x)
      rect.maxX = Math.max(rect.maxX, x)
      rect.minY = Math.min(rect.minY, y)
      rect.maxY = Math.max(rect.maxY, y)
    }
  }
  return rect
}

/** Projects the corners of a panel with the camera at the 35 degree working view. */
export function expectPanelInBand(name: string, widthCm: number, heightCm: number): void {
  const camera = findSceneObjectByName("Camera Object").getComponent("Component.Camera") as Camera
  const rect = panelRect(name, new vec2(widthCm, heightCm))
  const tanY = Math.tan(camera.fov / 2)
  const tanX = tanY * camera.aspect
  const maxX = Math.max(Math.abs(rect.minX), Math.abs(rect.maxX))
  const maxY = Math.max(Math.abs(rect.minY), Math.abs(rect.maxY))
  print(
    "[ClearCmosLeaf] " + name + " at step " + Step[currentStep()] + " corner tan x " + maxX.toFixed(3) + " y " + maxY.toFixed(3) +
      ", camera tan x " + tanX.toFixed(3) + " y " + tanY.toFixed(3),
  )
  must(maxX <= tanX && maxY <= tanY, name + " projects outside the camera view")
  must(maxX <= DISPLAY_HALF_TAN_X, name + " is outside the display band in x: " + maxX.toFixed(3))
  must(maxY <= DISPLAY_HALF_TAN_Y, name + " is outside the display band in y: " + maxY.toFixed(3))
}

/** Literal check that a part has no silkscreen label left on it. */
export function expectLabelRemoved(partName: string): void {
  const label = findSceneObjectByName(partName).children.find((c) => c.name === "Label")
  must(!!label && !label.enabled, partName + " Label is still on")
}

/** Distance in cm from the object to the eye ray through another object, measured at the working view. */
export function eyeRayGapCm(through: string, target: string): number {
  const eye = worldPosition("Camera Object")
  const direction = worldPosition(through).sub(eye).normalize()
  const toTarget = worldPosition(target).sub(eye)
  return toTarget.sub(direction.uniformScale(toTarget.dot(direction))).length
}

/** Tangent of a world point from the working view, on the view's right and up axes. */
function workingViewTanOf(point: vec3): vec2 {
  const view = workingView()
  const offset = point.sub(view.eye)
  const depth = offset.dot(view.forward)
  return new vec2(offset.dot(view.right) / depth, offset.dot(view.up) / depth)
}

export function workingViewTan(name: string): vec2 {
  return workingViewTanOf(worldPosition(name))
}

function visualAlpha(name: string): number {
  const visual = findSceneObjectByName(name).getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  return visual.mainMaterial.mainPass.baseColor.a as number
}

/** LedGlow alpha divided by LedHalo alpha, on the same frame. */
export function ledGlowRatio(): number {
  return visualAlpha("LedGlow") / visualAlpha("LedHalo")
}

/** Samples the LedHalo alpha per frame and returns its minimum and maximum. */
export async function sampleLedHaloRange(windowMs: number): Promise<vec2> {
  const begin = getTime()
  let min = 1
  let max = 0
  while ((getTime() - begin) * 1000 < windowMs) {
    await nextFrame()
    const alpha = visualAlpha("LedHalo")
    min = Math.min(min, alpha)
    max = Math.max(max, alpha)
  }
  return new vec2(min, max)
}

/** The edge-line alpha that the opening dims. */
export function edgeAlpha(): number {
  const edge = findSceneObjectByName("Board").children.find((c) => c.name === "EdgeLines")
  must(!!edge, "Board has no EdgeLines child")
  return (edge.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor.a as number
}

function noGoBox(name: string): SceneObject {
  const box = findSceneObjectByName(name).children.find((c) => c.name === "NoGoBox")
  must(!!box, name + " has no NoGoBox child")
  return box
}

/** The alpha of the filled warning box, or 0 while it is off. */
export function noGoFillAlpha(name: string): number {
  const fill = findSceneObjectByName(name).children.find((c) => c.name === "NoGoFlash")
  must(!!fill, name + " has no NoGoFlash child")
  if (!fill.enabled) return 0
  return (fill.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor.a as number
}

/** The height of the warning wall in cm, or 0 while it is off. */
export function noGoWallHeightCm(name: string): number {
  const wall = findSceneObjectByName(name).children.find((c) => c.name === "NoGoWall")
  must(!!wall, name + " has no NoGoWall child")
  return wall.enabled ? wall.getTransform().getLocalScale().y : 0
}

export function noGoEnabled(name: string): boolean {
  return noGoBox(name).enabled
}

export function noGoAlpha(name: string): number {
  const visual = noGoBox(name).getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  return visual.mainMaterial.mainPass.baseColor.a as number
}

export interface RefusalSample {
  maxOffsetCm: number
  shakeSeconds: number
  maxAlpha: number
  flashSeconds: number
  /** Peak of the filled warning box during the refusal. Only the current decoy fills. */
  maxFillAlpha: number
  /** Peak height of the warning wall during the refusal. A refusal must not raise it. */
  maxWallCm: number
}

const FLASH_ALPHA = 0.9
/** The offset in cm from which a frame counts as part of the shake. */
const SHAKE_SEEN_CM = 0.005
/** Below the fill the early warning sets, and far above the idle state, where the fill is off. */
const WARNING_FILL_ALPHA = 0.4
/** The flash must hold the full 600 ms minimum line time. The margin is one or two frames of sampling. */
const WARNING_HOLD_SECONDS = 0.5
/** The smallest no-go box is 2.3 cm tall. Its wall stands 3 cm above that, so a working wall reaches 5 cm. */
const WARNING_WALL_MIN_CM = 5

/** Samples the part offset and no-go alpha every frame while a pinch runs concurrently. */
export async function sampleRefusal(name: string, windowMs: number): Promise<RefusalSample> {
  const start = worldPosition(name)
  const begin = getTime()
  let maxOffsetCm = 0
  let maxAlpha = 0
  let maxFillAlpha = 0
  let maxWallCm = 0
  let firstShake = -1
  let lastShake = -1
  let firstFlash = -1
  let lastFlash = -1
  while ((getTime() - begin) * 1000 < windowMs) {
    await nextFrame()
    const now = getTime()
    const offset = worldPosition(name).distance(start)
    maxOffsetCm = Math.max(maxOffsetCm, offset)
    maxFillAlpha = Math.max(maxFillAlpha, noGoFillAlpha(name))
    maxWallCm = Math.max(maxWallCm, noGoWallHeightCm(name))
    // The shake tail is below 0.02 cm for its last 0.07 s. At 24 fps one sample can land on a zero crossing of that tail and end the span early, so the floor is 0.005 cm.
    if (offset > SHAKE_SEEN_CM) {
      if (firstShake < 0) firstShake = now
      lastShake = now
    }
    if (noGoEnabled(name)) {
      const alpha = noGoAlpha(name)
      maxAlpha = Math.max(maxAlpha, alpha)
      if (alpha >= FLASH_ALPHA) {
        if (firstFlash < 0) firstFlash = now
        lastFlash = now
      }
    }
  }
  return {
    maxOffsetCm,
    shakeSeconds: firstShake < 0 ? 0 : lastShake - firstShake,
    maxAlpha,
    flashSeconds: firstFlash < 0 ? 0 : lastFlash - firstFlash,
    maxFillAlpha,
    maxWallCm,
  }
}

/** Checks one observed refusal: the part shook for about 0.3 s and its box flashed. */
export function expectRefusalMotion(name: string, sample: RefusalSample): void {
  print("[ClearCmosLeaf] refusal " + name + " " + JSON.stringify(sample))
  must(sample.maxOffsetCm > 0.2, name + " shake peaked at " + sample.maxOffsetCm.toFixed(3) + " cm")
  must(
    sample.shakeSeconds > 0.15 && sample.shakeSeconds < 0.5,
    name + " shake lasted " + sample.shakeSeconds.toFixed(3) + " s",
  )
  must(sample.maxAlpha >= FLASH_ALPHA, name + " box alpha peaked at " + sample.maxAlpha.toFixed(2))
  must(
    sample.flashSeconds > 0.15 && sample.flashSeconds < 0.5,
    name + " box flash lasted " + sample.flashSeconds.toFixed(3) + " s",
  )
}

export interface EarlyWarningSample {
  /** Peak height of the warning wall in cm. */
  maxWallCm: number
  maxAlpha: number
  maxFillAlpha: number
  /** Seconds the filled box held its flash value. */
  fillHoldSeconds: number
  maxOffsetCm: number
  lineFirstOn: number
  lineSeconds: number
}

/** Samples one hover: the no-go alpha, the part offset, and when RefusalLine was on. Times are seconds from the start. */
export async function sampleEarlyWarning(name: string, windowMs: number): Promise<EarlyWarningSample> {
  const start = worldPosition(name)
  const begin = getTime()
  let maxWallCm = 0
  let maxAlpha = 0
  let maxFillAlpha = 0
  let fillFirst = -1
  let fillLast = -1
  let maxOffsetCm = 0
  let first = -1
  let last = -1
  while ((getTime() - begin) * 1000 < windowMs) {
    await nextFrame()
    const now = getTime() - begin
    maxAlpha = Math.max(maxAlpha, noGoAlpha(name))
    const fill = noGoFillAlpha(name)
    maxFillAlpha = Math.max(maxFillAlpha, fill)
    maxWallCm = Math.max(maxWallCm, noGoWallHeightCm(name))
    if (fill >= WARNING_FILL_ALPHA) {
      if (fillFirst < 0) fillFirst = now
      fillLast = now
    }
    maxOffsetCm = Math.max(maxOffsetCm, worldPosition(name).distance(start))
    if (isEnabled("RefusalLine")) {
      if (first < 0) first = now
      last = now
    }
  }
  return { maxAlpha, maxFillAlpha, maxWallCm, fillHoldSeconds: fillFirst < 0 ? 0 : fillLast - fillFirst, maxOffsetCm, lineFirstOn: first, lineSeconds: first < 0 ? 0 : last - first }
}

/** The early-warning count, which increases only when a warning plays. */
/** Every sound the Lens played, in order. */
export function sfxLog(): string[] {
  return main()["sfxLog"]
}

export function sfxCount(name: string): number {
  return sfxLog().filter((played) => played === name).length
}

/** Seconds from the step leaving fromStep until the sound first plays, or -1 if it never played in the window. */
export async function sampleSoundAfterStep(name: string, fromStep: Step, windowMs: number): Promise<number> {
  const before = sfxCount(name)
  let left = -1
  const end = getTime() + windowMs / 1000
  while (getTime() < end) {
    if (left < 0 && currentStep() !== fromStep) left = getTime()
    if (left >= 0 && sfxCount(name) > before) return getTime() - left
    await nextFrame()
  }
  return -1
}

export function earlyWarningCount(): number {
  return main()["earlyWarningCount"]
}

export function expectEarlyWarningFlash(name: string, sample: EarlyWarningSample): void {
  print("[ClearCmosLeaf] early warning " + name + " " + JSON.stringify(sample))
  must(sample.maxAlpha >= FLASH_ALPHA, name + " box alpha peaked at " + sample.maxAlpha.toFixed(2) + ", expected the flash value")
  must(sample.maxFillAlpha >= WARNING_FILL_ALPHA, name + " filled box alpha peaked at " + sample.maxFillAlpha.toFixed(2) + ", expected at least " + WARNING_FILL_ALPHA)
  must(sample.maxOffsetCm < 0.02, name + " moved " + sample.maxOffsetCm.toFixed(3) + " cm during the early warning")
  must(sample.maxWallCm >= WARNING_WALL_MIN_CM, name + " warning wall peaked at " + sample.maxWallCm.toFixed(2) + " cm, expected at least " + WARNING_WALL_MIN_CM)
}

/** The filled box holds for the full minimum line time. Only a sample window that spans the whole hold can prove this. */
export function expectWarningHold(name: string, sample: EarlyWarningSample): void {
  print("[ClearCmosLeaf] warning fill hold " + name + " " + sample.fillHoldSeconds.toFixed(3) + " s")
  must(sample.fillHoldSeconds >= WARNING_HOLD_SECONDS, name + " filled box held for only " + sample.fillHoldSeconds.toFixed(3) + " s, expected at least " + WARNING_HOLD_SECONDS)
}

const NO_GO_DECOYS = ["MemoryStick", "Socket", "BatteryRedPart", "RstJumper"]

/** Checks that the whole route starts at PowerCord, ends at Jumper, and stays out of every no-go box. */
export function expectRibbonFollowsRoute(): void {
  const route = main().ribbonRoute
  must(route.length > 20, "ribbon route has only " + route.length + " points")
  const rig = part("PowerCord").getSceneObject().getParent().getTransform().getWorldTransform()
  must(rig.multiplyPoint(route[0]).distance(worldPosition("PowerCord")) < 3, "ribbon does not start at PowerCord")
  must(rig.multiplyPoint(route[route.length - 1]).distance(worldPosition("Jumper")) < 3, "ribbon does not end at Jumper")
  for (const name of NO_GO_DECOYS) {
    const decoy = part(name)
    const center = decoy.getTransform().getLocalPosition().add(decoy.targetOffset)
    const halfX = decoy.colliderSize.x * 0.575
    const halfZ = decoy.colliderSize.z * 0.575
    for (const p of route) {
      const inside = Math.abs(p.x - center.x) < halfX && Math.abs(p.z - center.z) < halfZ
      must(!inside, "ribbon enters the " + name + " no-go box at x " + p.x.toFixed(1) + ", z " + p.z.toFixed(1))
    }
  }
}

export interface RibbonDrawSample {
  distinctPartialSteps: number
  firstPartialSeconds: number
  fullSeconds: number
}

export interface XRaySweepSample {
  minX: number
  maxX: number
  jumperIgnitedFirstBy: number
}

/** Samples the sweep bar and the alpha of the outline it should ignite. Time is seconds from the start of the sample. */
export async function sampleXRaySweep(windowMs: number): Promise<XRaySweepSample> {
  const begin = getTime()
  const bar = findSceneObjectByName("XRayScanBar")
  let minX = Infinity
  let maxX = -Infinity
  let jumperFirstAt = Infinity
  while ((getTime() - begin) * 1000 < windowMs) {
    await nextFrame()
    if (bar.enabled && isEnabled("XRay")) {
      const x = bar.getTransform().getLocalPosition().x
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      const battery = xRayAlpha("XRayBattery")
      const jumper = xRayAlpha("XRayJumper")
      if (jumper > 0.1 && battery < 0.05 && jumperFirstAt === Infinity) jumperFirstAt = x
    }
  }
  return { minX, maxX, jumperIgnitedFirstBy: jumperFirstAt }
}

function xRayAlpha(name: string): number {
  return (findSceneObjectByName(name).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor.a as number
}

/** Panel 1 fix 5: a 20% #7ADFFF fill on the named shell before the scan, and no fill after it. */
export function shellFillRgb(visualName: string): vec3 {
  const c = (findSceneObjectByName(visualName).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor
  return new vec3(c.r, c.g, c.b)
}

export function expectShellFill(visualName: string, level: number): void {
  const rgb = shellFillRgb(visualName)
  const expected = new vec3(0.478 * 0.2 * level, 0.875 * 0.2 * level, 0.2 * level)
  print("[ClearCmosLeaf] " + visualName + " fill " + rgb.toString() + ", expected " + expected.toString())
  must(rgb.distance(expected) < 0.012, visualName + " fill is " + rgb.toString() + ", expected " + expected.toString())
}

/** The outline runs from the CaseTray bottom to the Glass top. Its color is the full edge color. */
export function expectChassisOutline(): void {
  must(isEnabled("ChassisOutline"), "ChassisOutline is not on")
  const t = findSceneObjectByName("ChassisOutline").getTransform()
  const tray = findSceneObjectByName("CaseTray").getTransform()
  const glassTop = findSceneObjectByName("Glass").getTransform().getLocalPosition().y + 0.2
  const bottom = tray.getLocalPosition().y - tray.getLocalScale().y / 2
  const spanY = t.getLocalScale().y
  must(Math.abs(spanY - (glassTop - bottom)) < 0.05, "ChassisOutline height is " + spanY.toFixed(2) + ", expected " + (glassTop - bottom).toFixed(2))
  must(Math.abs(t.getLocalPosition().y - (glassTop + bottom) / 2) < 0.05, "ChassisOutline center y is " + t.getLocalPosition().y.toFixed(2))
  must(Math.abs(t.getLocalScale().x - tray.getLocalScale().x) < 0.05 && Math.abs(t.getLocalScale().z - tray.getLocalScale().z) < 0.05, "ChassisOutline footprint is not the CaseTray footprint")
  const c = (findSceneObjectByName("ChassisOutline").getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor
  must(Math.abs(c.a - 1) < 0.02 && Math.abs(c.g - 0.875) < 0.02, "ChassisOutline color is " + c.toString())
}

/** The Table carries bright edge lines, so the table reads on the additive display. */
export function expectTableEdge(): void {
  const edge = findSceneObjectByName("Table").children.find((c) => c.name === "EdgeLines")
  must(!!edge && edge.isEnabledInHierarchy, "Table has no enabled EdgeLines child")
  const c = (edge.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor
  // Audit: the table edge read as a stray bright bar, so it stays faint.
  must(c.a >= 0.15 && c.a <= 0.3, "Table edge alpha is " + c.a.toFixed(2) + ", expected 0.15 to 0.30")
}

/** The Monitor cage dims to about 30 percent until the first boot, and comes to full at Training and Done. */
export function expectMonitorEdgeAlpha(expected: number): void {
  const edge = findSceneObjectByName("MonitorBody").children.find((c) => c.name === "EdgeLines")
  must(!!edge, "MonitorBody has no EdgeLines child")
  const a = (edge.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor.a as number
  print("[ClearCmosLeaf] Monitor edge alpha " + a.toFixed(2) + " at step " + Step[currentStep()])
  must(Math.abs(a - expected) < 0.03, "Monitor edge alpha is " + a.toFixed(2) + " at step " + Step[currentStep()] + ", expected " + expected)
}

/** X-ray outlines lit, callout at 3x, GPU edges dimmed after the sweep finished. */
export function expectXRayLit(): void {
  must(!isEnabled("XRayScanBar"), "XRayScanBar is still on after the sweep")
  for (const name of ["XRayJumper", "XRayBattery", "XRayCallout", "XRayCalloutRst", "XRayPierce"]) {
    must(isEnabled(name), name + " is not enabled")
    must(xRayAlpha(name) > 0.5, name + " alpha is " + xRayAlpha(name).toFixed(2))
  }
  const callout = findSceneObjectByName("XRayCallout").getTransform().getLocalScale()
  must(Math.abs(callout.x - 3) < 0.01 && Math.abs(callout.z - 3) < 0.01, "XRayCallout scale is " + callout.toString() + ", expected 3x")
  const gpuEdges = findSceneObjectByName("GPU").children.find((c) => c.name === "GpuVisual").children.find((c) => c.name === "EdgeLines")
  const gpuAlpha = (gpuEdges.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor.a as number
  must(Math.abs(gpuAlpha - 0.45) < 0.03, "GPU edge alpha is " + gpuAlpha.toFixed(2) + " under the X-ray")
  expectCalloutLabel()
}

/** Literal CLR_CMOS callout cage: center x -10.95, z 10.85, half x 0.9, half z 1.95 at 3x. */
const CALLOUT_CLR_FAR_EDGE_Z_CM = 8.9

/** The callout carries the CLR_CMOS label beside it, on the far side of its cage. */
export function expectCalloutLabel(): void {
  const label = findSceneObjectByName("Jumper").children.find((c) => c.name === "Label")
  must(!!label && label.enabled, "Jumper has no enabled Label")
  const text = label.getComponent("Component.Text") as Text
  must(text.text === "CLR_CMOS", 'Jumper Label says "' + text.text + '"')
  const box = text.getBoundingBox()
  const rig = findSceneObjectByName("Rig").getTransform().getInvertedWorldTransform()
  const local = rig.multiplyPoint(label.getTransform().getWorldPosition())
  print("[ClearCmosLeaf] callout label x " + local.x.toFixed(2) + " left " + (local.x + box.left).toFixed(2) + " z " + local.z.toFixed(2))
  must(local.z < CALLOUT_CLR_FAR_EDGE_Z_CM, "CLR_CMOS label overlaps the callout cage, z " + local.z.toFixed(2))
  must(Math.abs(local.z - CALLOUT_CLR_FAR_EDGE_Z_CM) < 3, "CLR_CMOS label is not beside the callout, z " + local.z.toFixed(2))
  must(Math.abs(local.x + 14.1) < 1.5, "CLR_CMOS label is not beside the CLR_CMOS pins, x " + local.x.toFixed(2))
}

/** Fix 3: the tool is large enough to read, and its approach is a real move inside the frame. The first sample lands a frame into the 4 cm approach, so travel measured 2.65 to 2.71 cm in the earlier Lens Studio logs. At a 24 fps Preview it measured 1.8 to 2.1 cm, so the floor is 1.5 cm. An instant jump still reads 0 cm. */
const SCREWDRIVER_MIN_LENGTH_CM = 14
const SCREWDRIVER_MIN_TRAVEL_CM = 1.5

export interface ContactSample {
  toolLengthCm: number
  startTipTan: vec2
  startEndTan: vec2
  holdSeconds: number
  toolSeen: boolean
  maxTravelCm: number
  flashFirst: number
  flashLast: number
  tipGapAtFlashCm: number
  xRayDuringFlash: boolean
  calloutDuringFlash: boolean
  flashColorError: number
}

const PAD_FLASH_COLOR = new vec3(0.4196, 1, 0.6196)

/** Samples the screwdriver and the pad flash per frame while the Jumper pinch runs. */
export async function sampleContact(windowMs: number): Promise<ContactSample> {
  const begin = getTime()
  const tool = findSceneObjectByName("Screwdriver")
  const flash = findSceneObjectByName("JumperPadFlash")
  const jumper = part("Jumper").getTransform().getLocalPosition()
  const contact = new vec3(jumper.x, jumper.y + 0.45, jumper.z)
  let firstAtPins = -1
  let lastAtPins = -1
  const sample: ContactSample = {
    toolLengthCm: 0, startTipTan: vec2.zero(), startEndTan: vec2.zero(),
    holdSeconds: 0, toolSeen: false, maxTravelCm: 0, flashFirst: -1, flashLast: -1, tipGapAtFlashCm: Infinity,
    xRayDuringFlash: false, calloutDuringFlash: false, flashColorError: Infinity,
  }
  let firstPosition: vec3 | null = null
  while ((getTime() - begin) * 1000 < windowMs) {
    await nextFrame()
    const now = getTime() - begin
    if (tool.enabled) {
      sample.toolSeen = true
      const position = tool.getTransform().getLocalPosition()
      if (!firstPosition) {
        firstPosition = position
        const mesh = (tool.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh
        sample.toolLengthCm = mesh.aabbMax.y - mesh.aabbMin.y
        const toWorld = tool.getTransform().getWorldTransform()
        sample.startTipTan = workingViewTanOf(toWorld.multiplyPoint(vec3.zero()))
        sample.startEndTan = workingViewTanOf(toWorld.multiplyPoint(new vec3(0, mesh.aabbMax.y, 0)))
      }
      sample.maxTravelCm = Math.max(sample.maxTravelCm, position.distance(firstPosition))
      if (position.distance(contact) < 0.5) {
        if (firstAtPins < 0) firstAtPins = now
        lastAtPins = now
      }
      if (flash.enabled && sample.flashFirst < 0) sample.tipGapAtFlashCm = position.distance(contact)
    }
    if (flash.enabled) {
      if (sample.flashFirst < 0) {
        sample.flashFirst = now
        sample.xRayDuringFlash = isEnabled("XRay")
        sample.calloutDuringFlash = isEnabled("XRayCallout")
        const color = (flash.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor
        sample.flashColorError = Math.abs(color.r - PAD_FLASH_COLOR.x) + Math.abs(color.g - PAD_FLASH_COLOR.y) + Math.abs(color.b - PAD_FLASH_COLOR.z)
      }
      sample.flashLast = now
    }
  }
  sample.holdSeconds = firstAtPins < 0 ? 0 : lastAtPins - firstAtPins
  return sample
}

/** The tool travels to the pins, the pads flash #6BFF9E for about 150 ms at the touch, and the X-ray is still on. */
export function expectContact(sample: ContactSample): void {
  print("[ClearCmosLeaf] contact " + JSON.stringify(sample))
  must(sample.toolSeen, "Screwdriver never came on")
  must(sample.maxTravelCm >= SCREWDRIVER_MIN_TRAVEL_CM, "Screwdriver moved only " + sample.maxTravelCm.toFixed(2) + " cm")
  must(sample.toolLengthCm >= SCREWDRIVER_MIN_LENGTH_CM, "Screwdriver is only " + sample.toolLengthCm.toFixed(2) + " cm long")
  for (const [end, tan] of [["tip", sample.startTipTan], ["handle end", sample.startEndTan]] as [string, vec2][]) {
    must(Math.abs(tan.x) <= DISPLAY_HALF_TAN_X && Math.abs(tan.y) <= DISPLAY_HALF_TAN_Y, "Screwdriver " + end + " starts outside the display band at tan x " + tan.x.toFixed(3) + " y " + tan.y.toFixed(3))
  }
  must(sample.flashFirst >= 0, "JumperPadFlash never came on")
  const flashSeconds = sample.flashLast - sample.flashFirst
  must(flashSeconds > 0.08 && flashSeconds < 0.3, "JumperPadFlash lasted " + flashSeconds.toFixed(3) + " s")
  must(sample.holdSeconds > 1.7 && sample.holdSeconds < 2.4, "Screwdriver held on the pins for " + sample.holdSeconds.toFixed(2) + " s, expected about 2")
  must(sample.tipGapAtFlashCm < 0.3, "Screwdriver tip was " + sample.tipGapAtFlashCm.toFixed(2) + " cm from the pins at the flash")
  must(sample.xRayDuringFlash && sample.calloutDuringFlash, "XRay or XRayCallout was off at the flash")
  must(sample.flashColorError < 0.02, "JumperPadFlash color is off by " + sample.flashColorError.toFixed(3))
  must(!isEnabled("Screwdriver"), "Screwdriver stayed on")
  must(!isEnabled("JumperPadFlash"), "JumperPadFlash stayed on")
}

/** The bar crossed the board from the near-left corner, so the jumper lights before the battery. */
export function expectXRaySweep(sample: XRaySweepSample): void {
  print("[ClearCmosLeaf] xray sweep " + JSON.stringify(sample))
  must(sample.minX < -9 && sample.maxX > 9, "XRayScanBar only moved from " + sample.minX.toFixed(1) + " to " + sample.maxX.toFixed(1))
  must(sample.jumperIgnitedFirstBy < -9, "XRayJumper did not ignite before XRayBattery, first apart at x " + sample.jumperIgnitedFirstBy)
}

/** Samples ribbon progress per frame while the Anchor pinch runs. Times are seconds from the start of the sample. */
export async function sampleRibbonDraw(windowMs: number): Promise<RibbonDrawSample> {
  const begin = getTime()
  const seen = new Set<number>()
  let firstPartial = -1
  let full = -1
  while ((getTime() - begin) * 1000 < windowMs) {
    await nextFrame()
    const progress = main().ribbonProgress
    const now = getTime() - begin
    if (progress > 0 && firstPartial < 0) firstPartial = now
    if (progress > 0 && progress < 1) seen.add(progress)
    if (progress === 1 && full < 0) full = now
  }
  return { distinctPartialSteps: seen.size, firstPartialSeconds: firstPartial, fullSeconds: full }
}

/** The ribbon draws gradually over about 1 s, and it is complete by the settle time after Anchor. */
export function expectRibbonDrawn(sample: RibbonDrawSample): void {
  print("[ClearCmosLeaf] ribbon draw " + JSON.stringify(sample))
  must(main().ribbonProgress === 1, "ribbon progress is " + main().ribbonProgress.toFixed(2) + " after the Anchor settle")
  must(sample.distinctPartialSteps >= 3, "ribbon showed only " + sample.distinctPartialSteps + " partial steps, so it did not draw gradually")
  const drawSeconds = sample.fullSeconds - sample.firstPartialSeconds
  must(drawSeconds > 0.5 && drawSeconds < 1.4, "ribbon drew in " + drawSeconds.toFixed(2) + " s, expected about 1 s")
}

/** Literal ceilings from the punch list: the ribbon width and next-step ring radius. */
export function expectThinOverlays(): void {
  must(main().ribbonWidthCm <= 0.35, "ribbon is " + main().ribbonWidthCm.toFixed(2) + " cm wide")
  for (const name of PART_NAMES) {
    const ring = findSceneObjectByName(name).children.find((c) => c.name === "Ring")
    must(!!ring, name + " has no Ring child")
    const radius = ring.getTransform().getLocalScale().x
    must(radius <= 4.61, name + " ring scale is " + radius.toFixed(2) + ", expected at most 4 times 1.15")
  }
}

/** Panel 1 fix 6: ArrowVisual is a flat arrow at unit scale, twice the first chevron, with a shaft behind the head. */
export function expectArrowHasShaft(): void {
  const visualObject = findSceneObjectByName("ArrowVisual")
  const scale = visualObject.getTransform().getLocalScale()
  must(Math.abs(scale.x - 1) < 0.01 && Math.abs(scale.y - 1) < 0.01 && Math.abs(scale.z - 1) < 0.01, "ArrowVisual scale is not 1")
  const mesh = (visualObject.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh
  const size = mesh.aabbMax.sub(mesh.aabbMin)
  print("[ClearCmosLeaf] ArrowVisual bounds " + size.toString())
  must(size.y < 0.05, "ArrowVisual is not flat, height " + size.y.toFixed(2))
  must(size.x > 5.8 && size.x < 6.8, "ArrowVisual span is " + size.x.toFixed(2) + " cm, expected about 6")
  // A chevron head alone is 3.8 cm long, so this length needs the shaft.
  must(size.z > 7 && size.z < 8.2, "ArrowVisual length is " + size.z.toFixed(2) + " cm, expected a head and a shaft, about 7.6")
  must(mesh.aabbMin.z < -3, "ArrowVisual has no shaft behind the head, min z " + mesh.aabbMin.z.toFixed(2))
}

/** Aims a camera ray at the part center and checks that the physics probe hits that part first. */
export async function expectPartWinsRay(target: string): Promise<void> {
  const camera = main().cameraObject.getTransform().getWorldPosition()
  const script = findSceneObjectByName(target).getComponent(ClearCmosPart.getTypeName()) as ClearCmosPart
  const center = script ? script.targetWorldPosition : worldPosition(target)
  const direction = center.sub(camera).normalize()
  main()["testRay"] = { start: camera, direction }
  await nextFrame()
  await nextFrame()
  await nextFrame()
  const firstHit = new Promise<string>((resolve) => {
    // Same selection as the SIK cursor: the nearest hit whose collider belongs to an Interactable.
    Physics.createGlobalProbe().rayCastAll(camera, camera.add(direction.uniformScale(500)), (hits) => {
      const manager = InteractionManager.getInstance()
      const first = hits.find((h) => manager.getInteractableByCollider(h.collider) !== null)
      if (!first) return resolve("nothing")
      // A UI Kit button puts its collider on a child, so the hit counts for its owner.
      let so: SceneObject | null = first.collider.getSceneObject()
      while (so && so.name !== target) so = so.getParent()
      resolve(so ? target : first.collider.getSceneObject().name)
    })
  })
  const name = await firstHit
  main()["testRay"] = null
  await nextFrame()
  must(name === target, "camera ray to " + target + " hits " + name + " at step " + Step[currentStep()])
}

export async function expectMemoryWinsRay(): Promise<void> {
  await expectPartWinsRay("MemoryStick")
}

export class ClearCmosLeafInteractor extends DefaultLeafInteractor {
  private find(name: string): Interactable {
    const found = findInteractablesByName(name, undefined, true)[0]
    if (!found) throw new Error('No enabled Interactable on "' + name + '"')
    return found
  }

  async pinch(name: string): Promise<void> {
    await this.trigger(this.find(name))
    await settle(200)
  }

  /** A double press: two triggers with no settle between them. Reports whether the first part was still lifting when the second trigger ended. */
  async doublePress(first: string, second: string): Promise<boolean> {
    const firstTarget = this.find(first)
    const secondTarget = this.find(second)
    await this.trigger(firstTarget)
    let stillLifting = false
    const off = secondTarget.onTriggerEnd.add(() => {
      stillLifting = part(first).isMoving
    })
    await this.trigger(secondTarget)
    off()
    return stillLifting
  }

  private holdRayAt(aim: vec3): void {
    this.startPoint = main().cameraObject.getTransform().getWorldPosition()
    this.endPoint = aim
  }

  /**
   * A real cursor stays put when a covering part lifts. This pinches the cover with the ray held on aim,
   * then keeps exactly that ray and targets the part underneath, as SIK does once the cover is gone.
   */
  async pinchAndHold(cover: string, under: string, aim: vec3): Promise<void> {
    const coverTarget = this.find(cover)
    const underTarget = this.find(under)
    await this.enterHover(coverTarget)
    await nextFrame()
    await nextFrame()
    this.holdRayAt(aim)
    const triggerStarted = awaitEventOnce(coverTarget.onTriggerStart)
    this.setTriggerType(InteractorTriggerType.Select)
    await triggerStarted
    await nextFrame()
    this.holdRayAt(aim)
    const triggerEnded = awaitEventOnce(coverTarget.onTriggerEnd)
    this.setTriggerType(InteractorTriggerType.None)
    await nextFrame()
    await triggerEnded
    this.overrideInteractable = underTarget
    await nextFrame()
  }

  /** A real cursor rests on a cover with its ray through a part under it. SIK targets the cover. */
  async restOnCover(cover: string, aim: vec3, durationMs: number): Promise<void> {
    await this.enterHover(this.find(cover))
    await nextFrame()
    await nextFrame()
    this.holdRayAt(aim)
    await settle(durationMs)
    await this.exitHover()
  }

  /** Moves the held ray, as a person does when they shift the cursor. */
  moveHeldRayBy(offset: vec3): void {
    this.endPoint = this.endPoint.add(offset)
  }

  async releaseHeld(): Promise<void> {
    await this.exitHover()
  }

  async hoverPart(name: string, durationMs: number): Promise<void> {
    await this.hover(this.find(name), durationMs)
  }

  /** Leaf 2.0.2 applies the drag vector on each drag update, so the total is split per frame. */
  async dragBy(name: string, total: vec3, durationMs: number, settleMs: number = 300): Promise<void> {
    let seconds = 0
    const samples = 15
    for (let i = 0; i < samples; i++) {
      await nextFrame()
      seconds += getDeltaTime()
    }
    const frames = Math.max(1, Math.round((durationMs / 1000) / (seconds / samples)))
    const target = this.find(name)
    // Direct mode: the manipulation follows the fingertip, as a hand inside the case does.
    this.targetingMode = TargetingMode.Direct
    await this.drag(target, total.uniformScale(1 / frames), durationMs)
    if (settleMs > 0) await settle(settleMs)
  }

  /**
   * B3: re-grabs a part during its return animation. Reports whether the animation was
   * still writing the position after the part was held. Direct targeting from dragBy stays set.
   */
  async regrabDuringReturn(name: string, step: vec3, durationMs: number): Promise<boolean> {
    const target = this.find(name)
    let held = false
    const off = target.onDragStart.add(() => {
      held = true
    })
    const dragging = this.drag(target, step, durationMs)
    // Bounded: a drag that never starts must fail this scenario, not hang it.
    for (let frames = 0; frames < 300 && !held; frames++) await nextFrame()
    must(held, name + " never reported a drag start for the re-grab")
    await nextFrame()
    const movingWhileHeld = part(name).isMoving
    off()
    await dragging
    await settle(200)
    return movingWhileHeld
  }

  async reachAnchorDone(): Promise<void> {
    await settle(1500)
    await this.pinch("SymptomButton")
    await settle(300)
    await this.pinch("AnchorButton")
    await settle(AFTER_STEP_MS)
  }

  async reachFix(): Promise<void> {
    await this.reachAnchorDone()
    await this.pinch("PowerCord")
    await settle(AFTER_STEP_MS)
    await this.pinch("Glass")
    await settle(AFTER_STEP_MS)
  }

  /** The battery route only: lifts the GPU and waits for the Battery ring and pad. */
  async liftGpu(): Promise<void> {
    await this.pinch("GPU")
    await settle(AFTER_STEP_MS)
  }
}

const MIN_MOVE_CM = 1

/** Pinches a part and checks that it moved away and that the step advanced. */
export async function liftAndCheck(
  interactor: ClearCmosLeafInteractor,
  name: string,
  nextStep: Step,
): Promise<void> {
  const before = worldPosition(name)
  await interactor.pinch(name)
  await settle(AFTER_STEP_MS)
  expectStep(nextStep)
  const moved = worldPosition(name).distance(before)
  must(moved > MIN_MOVE_CM, name + " moved only " + moved.toFixed(2) + " cm")
}

/** Waits up to maxFrames for the object to be enabled while another action runs. */
export async function waitUntilEnabled(name: string, maxFrames: number): Promise<boolean> {
  for (let i = 0; i < maxFrames; i++) {
    if (isEnabled(name)) return true
    await nextFrame()
  }
  return isEnabled(name)
}

const TRAINING_TEST_SECONDS = 3
const TRAINING_LINE = "First boot may take minutes."
const TRAINING_HOLD_LINE = "Give memory training several minutes."
const DONE_LINE = "Simulated recovery: POST successful.\nMonitor now shows the boot screen.\nNext: BIOS Setup, Load Optimized Defaults."

/** Samples the done ring every frame: its peak radius and how long it was on. */
export async function sampleDoneRing(windowMs: number): Promise<{ maxRadius: number; onSeconds: number; colorError: number }> {
  const begin = getTime()
  let maxRadius = 0
  let colorError = Infinity
  let first = -1
  let last = -1
  while ((getTime() - begin) * 1000 < windowMs) {
    await nextFrame()
    const ring = findSceneObjectByName("DoneRing")
    if (ring.enabled) {
      maxRadius = Math.max(maxRadius, ring.getTransform().getLocalScale().x)
      const c = (ring.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mainMaterial.mainPass.baseColor
      colorError = Math.abs(c.r - 0.478) + Math.abs(c.g - 0.875) + Math.abs(c.b - 1)
      const now = getTime()
      if (first < 0) first = now
      last = now
    }
  }
  return { maxRadius, onSeconds: first < 0 ? 0 : last - first, colorError }
}

/**
 * B4: polls per frame until the step leaves fromStep. LEAF releases the pinch one frame before it ends
 * the hover, so the first frame of the new step is the frame a stale outline would still be on.
 */
export async function outlineOnAtStepChange(partName: string, fromStep: Step, windowMs: number): Promise<{ changed: boolean; outlineOn: boolean }> {
  const outline = findSceneObjectByName(partName).children.find((c) => c.name === "Outline")
  must(!!outline, partName + " has no Outline child")
  const begin = getTime()
  while ((getTime() - begin) * 1000 < windowMs) {
    await nextFrame()
    if (currentStep() !== fromStep) return { changed: true, outlineOn: outline.enabled }
  }
  return { changed: false, outlineOn: false }
}

/** Returns true if RefusalLine was on at any frame during the window. */
export async function refusalLineSeenDuring(windowMs: number): Promise<boolean> {
  const begin = getTime()
  let seen = false
  while ((getTime() - begin) * 1000 < windowMs) {
    await nextFrame()
    if (isEnabled("RefusalLine")) seen = true
  }
  return seen
}

/** The Wait card rows, as literals from the brief, plus proof that the countdown is not rewritten per frame (B5). */
export function expectWaitCardCopy(): void {
  const rows = findSceneObjectByName("WaitCard").children.find((c) => c.name === "Content").children.filter((c) => c.name === "Row")
  const note = rows[1].getComponent("Component.Text").text
  must(note === "Time-lapsed.", 'WaitCard note says "' + note + '"')
  const explanation = rows[2].getComponent("Component.Text").text
  must(explanation === "Clears saved BIOS settings.", 'WaitCard line says "' + explanation + '"')
  const countdown = rows[0].getComponent("Component.Text").text
  must(/^\d+ s$/.test(countdown), 'WaitCard countdown says "' + countdown + '"')
}

export function countdownWrites(): number {
  return main().waitCard["countdownWrites"]
}

/** Shared end of S5a and S5b: refusal before Rebuild, then Rebuild, then power on. */
export async function finishAfterFix(interactor: ClearCmosLeafInteractor): Promise<void> {
  await settle(1500)
  expectStep(Step.Rebuild)
  must(!isEnabled("SafePathRibbon"), "SafePathRibbon stayed on after the fix")
  must(isEnabled("RebuildButton"), "RebuildButton is not enabled after the wait")

  await interactor.pinch("PowerButton")
  await settle(100)
  expectStep(Step.Rebuild)
  expectRefused("PowerButton", null)
  const line = main().refusalLine
  const rebuild = main().rebuildButton
  expectPanelsApart("RefusalLine", "RebuildButton", new vec2(line.widthCm, line.heightCm), new vec2(rebuild.widthCm, rebuild.heightCm))
  must(isEnabled("DramLed"), "DramLed turned off on a refused power on")

  await interactor.pinch("RebuildButton")
  await settle(1200)
  expectStep(Step.PowerOn)
  expectRings(["PowerButton"])
  expectLabel("StepLabel", "PowerButton", "Press the power button")
  must(part("PowerButton")["collider"].enabled, "PowerButton collider is off at PowerOn, so a real cursor cannot press it")
  for (const name of ["Glass", "GPU", "PowerCord", "Battery"]) {
    must(worldPosition(name).distance(part(name).homeWorldPosition) < 0.05, name + " is not home after Rebuild")
  }
  // The open Monitor cage stays quiet until the boot pays it off.
  expectMonitorEdgeAlpha(0.3)

  // First boot: the light stays on, the note shows, and the monitor still has no signal.
  main().trainingSeconds = TRAINING_TEST_SECONDS
  await interactor.pinch("PowerButton")
  await settle(300)
  expectStep(Step.Training)
  must(isEnabled("DramLed"), "DramLed went out at power on, before the hold")
  must(!isEnabled("RefusalLine"), "RefusalLine is on at the start of the hold")
  expectMonitorEdgeAlpha(1)
  must(labelText("SymptomLabel").indexOf(TRAINING_LINE) >= 0, 'SymptomLabel says "' + labelText("SymptomLabel") + '", expected the training line')
  must(monitorText() === "No signal", 'MonitorScreen says "' + monitorText() + '" during the hold')
  expectRings([])

  // A second pinch is a calm note: no step change and no refusal motion.
  const before = worldPosition("PowerButton")
  const holdSample = sampleRefusal("PowerButton", 500)
  const thudsBeforeNote = sfxCount("refusal_thud")
  await interactor.pinch("PowerButton")
  const hold = await holdSample
  expectStep(Step.Training)
  expectRefused("PowerButton", TRAINING_HOLD_LINE)
  must(sfxCount("refusal_thud") === thudsBeforeNote, "the calm note during the hold played refusal_thud")
  must(hold.maxOffsetCm < 0.02, "PowerButton shook on the calm note, offset " + hold.maxOffsetCm.toFixed(3))
  must(hold.flashSeconds === 0, "PowerButton box flashed on the calm note")
  must(worldPosition("PowerButton").distance(before) < 0.01, "PowerButton moved during the hold")
  const labelPanel = main().symptomLabel
  expectPanelsApart("RefusalLine", "SymptomLabel", new vec2(main().refusalLine.widthCm, main().refusalLine.heightCm), new vec2(labelPanel.widthCm, labelPanel.heightCm))

  // After the hold the light goes out with one expanding ring, then the boot screen and the final line.
  const bootRingsBefore = sfxCount("boot_ring")
  const ringSample = sampleDoneRing((TRAINING_TEST_SECONDS + 3) * 1000)
  const ring = await ringSample
  must(sfxCount("boot_ring") === bootRingsBefore + 1, "boot_ring played " + (sfxCount("boot_ring") - bootRingsBefore) + " times at the boot ending")
  print("[ClearCmosLeaf] done ring " + JSON.stringify(ring))
  must(ring.maxRadius >= 8.5, "DoneRing peaked at radius " + ring.maxRadius.toFixed(2))
  // The ring holds at full radius long enough to read on video.
  must(ring.onSeconds > 1.2 && ring.onSeconds < 1.8, "DoneRing was on for " + ring.onSeconds.toFixed(3) + " s, expected about 1.5")
  must(ring.colorError < 0.02, "DoneRing color is off #7ADFFF by " + ring.colorError.toFixed(3))
  expectStep(Step.Done)
  must(!isEnabled("DramLed"), "DramLed is still on after the hold")
  must(!isEnabled("DoneRing"), "DoneRing stayed on after its 1.5 s")
  expectMonitorEdgeAlpha(1)
  must(monitorText().indexOf("Booting") >= 0, 'MonitorScreen says "' + monitorText() + '"')
  must(labelText("SymptomLabel") === DONE_LINE, 'SymptomLabel says "' + labelText("SymptomLabel") + '"')
  expectPanelTextFits("SymptomLabel")
}
