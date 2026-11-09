// ClearCmosNextCue.ts
// Owns: the one NextCueArrow that stands over the place the user must act now.
// Inputs: its size and motion below. ClearCmosMain calls configure() once and setTarget() at each step.
// Must not: decide the step, read flow state, or carry a collider. It never catches a pinch.
// The pose is computed once per target. Each frame only writes one reused position and one reused color.

import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { InteractorInputType } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import { RING_PULSE_LOOP_SECONDS, RING_PULSE_START_SECONDS } from "./ClearCmosPart"
import { buildArrow } from "./ClearCmosMeshKit"

/** The same green as the next-step ring, because the label says "the step with the green ring". */
const NEXT_GREEN_R = 0.42
const NEXT_GREEN_G = 1
const NEXT_GREEN_B = 0.62
const ARROW_BAR_CM = 0.34
/** Above the amber callout (13), the contact visuals (14), and the Jumper ring (15). */
const RENDER_ORDER = 16
const FULL_ALPHA = 1

@component
export class ClearCmosNextCue extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClearCmosNextCue – the arrow at the next step</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Arrow width in cm.")
  @widget(new SliderWidget(1, 6, 0.1))
  widthCm: number = 3

  @input
  @hint("Arrow length in cm.")
  @widget(new SliderWidget(1, 8, 0.1))
  lengthCm: number = 3.8

  @input
  @hint("Gap in cm between the arrow tip and the top of the target's ring or button.")
  @widget(new SliderWidget(0, 5, 0.1))
  tipGapCm: number = 1.5

  @input
  @hint("How far the arrow bobs in cm, in phase with the ring pulse.")
  @widget(new SliderWidget(0, 2, 0.1))
  bobCm: number = 0.5

  @input
  @hint("Arrow alpha while the user hovers the target.")
  @widget(new SliderWidget(0, 1, 0.05))
  hoverAlpha: number = 0.3
  @ui.group_end

  private visual: RenderMeshVisual
  private material: Material
  private cameraObject: SceneObject
  private active = false
  private suppressed = false
  private since = 0
  private hoverObject: SceneObject | null = null
  private interactable: Interactable | null = null
  private color = new vec4(NEXT_GREEN_R, NEXT_GREEN_G, NEXT_GREEN_B, FULL_ALPHA)
  private appliedAlpha = -1
  private rest = new vec3(0, 0, 0)
  private bobAxis = new vec3(0, 0, 0)
  /** Reused, so the bob allocates nothing per frame. */
  private position = new vec3(0, 0, 0)

  onAwake() {
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  /** Called once by ClearCmosMain on its first tick, before the first setTarget. */
  configure(overlayMaterial: Material, cameraObject: SceneObject): void {
    this.cameraObject = cameraObject
    this.material = overlayMaterial.clone()
    this.material.mainPass.depthTest = false
    this.material.mainPass.depthWrite = false
    this.material.mainPass.baseColor = this.color
    const halfLength = this.lengthCm * 0.5
    this.visual = this.sceneObject.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    this.visual.mesh = buildArrow(ARROW_BAR_CM, halfLength, this.widthCm * 0.5, -halfLength)
    this.visual.mainMaterial = this.material
    this.visual.setRenderOrder(RENDER_ORDER)
    this.visual.enabled = false
  }

  /**
   * Stands the arrow over a target, tip down in the view. Pass null to hide it.
   * worldOffset moves the aim point, and ringRadiusCm clears a flat ring around it.
   * hoverObject holds the Interactable that fades the arrow while hovered.
   * tipGapCm overrides the Inspector gap for a target with no room above it.
   */
  setTarget(obj: SceneObject | null, worldOffset?: vec3, hoverObject: SceneObject | null = obj, ringRadiusCm: number = 0, tipGapCm: number = this.tipGapCm): void {
    this.active = obj !== null
    this.hoverObject = hoverObject
    this.interactable = null
    if (!obj) {
      this.applyVisible()
      return
    }
    const aim = worldOffset ? obj.getTransform().getWorldPosition().add(worldOffset) : obj.getTransform().getWorldPosition()
    const cam = this.cameraObject.getTransform()
    const toCamera = cam.getWorldPosition().sub(aim).normalize()
    // The camera's up laid onto the arrow's plane, so the arrow reads upright off to the side. World up would lean with the 35 degree view.
    const camUp = cam.up
    let viewUp = camUp.sub(toCamera.uniformScale(camUp.dot(toCamera)))
    viewUp = viewUp.length > 0.001 ? viewUp.normalize() : camUp
    // A flat ring reaches this far up the view.
    const clearance = ringRadiusCm * Math.abs(toCamera.y) + tipGapCm + this.lengthCm * 0.5
    const center = aim.add(viewUp.uniformScale(clearance))
    this.rest.x = center.x
    this.rest.y = center.y
    this.rest.z = center.z
    this.bobAxis.x = viewUp.x
    this.bobAxis.y = viewUp.y
    this.bobAxis.z = viewUp.z
    this.sceneObject.getTransform().setWorldRotation(quat.lookAt(viewUp.uniformScale(-1), toCamera))
    this.since = getTime()
    this.applyVisible()
    this.tick()
  }

  /** The out-of-view arrow owns the cue while the target is off to the side. */
  setSuppressed(suppressed: boolean): void {
    if (suppressed === this.suppressed) return
    this.suppressed = suppressed
    this.applyVisible()
  }

  private applyVisible(): void {
    if (this.visual) this.visual.enabled = this.active && !this.suppressed
  }

  private tick(): void {
    if (!this.active || this.suppressed) return
    // A UI Kit button adds its Interactable when it first starts, so this looks again until it is there.
    if (!this.interactable && this.hoverObject) {
      this.interactable = this.hoverObject.getComponent(Interactable.getTypeName()) as Interactable
    }
    const hovered = !!this.interactable && this.interactable.hoveringInteractor !== InteractorInputType.None
    const alpha = hovered ? this.hoverAlpha : FULL_ALPHA
    if (alpha !== this.appliedAlpha) {
      this.appliedAlpha = alpha
      this.color.a = alpha
      this.material.mainPass.baseColor = this.color
    }
    // At the ring's brightest the arrow is nearest its target.
    const t = getTime() - this.since - RING_PULSE_START_SECONDS
    const away = this.bobCm * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / RING_PULSE_LOOP_SECONDS))
    this.position.x = this.rest.x + this.bobAxis.x * away
    this.position.y = this.rest.y + this.bobAxis.y * away
    this.position.z = this.rest.z + this.bobAxis.z * away
    this.sceneObject.getTransform().setWorldPosition(this.position)
  }
}
