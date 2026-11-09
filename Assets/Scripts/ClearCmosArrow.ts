// ClearCmosArrow.ts
// Owns: the tag-along world-space Arrow that points to the power cord while it is out of view.
// Inputs: camera object, arrow object, target object.
// Must not: decide the step. ClearCmosMain calls setActive().
// This component sits on a separate controller object so it keeps updating while Arrow is disabled.

import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { buildArrow } from "./ClearCmosMeshKit"

/** Twice the first chevron, with a shaft, so the direction reads at a glance. */
const ARROW_BAR_CM = 0.36
const ARROW_TIP_Z_CM = 3.6
const ARROW_HALF_SPAN_CM = 3
const ARROW_TAIL_Z_CM = -4
/** Below the BoardLabel strip at the working view. */
const BELOW_GAZE_CM = 11

@component
export class ClearCmosArrow extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClearCmosArrow – points to the power cord</span>')
  @ui.separator
  @ui.group_start("References")
  @input
  @hint("The camera object.")
  cameraObject!: SceneObject

  @input
  @hint("The arrow SceneObject. It is enabled only while the target is out of view.")
  arrow!: SceneObject

  @input
  @hint("The object the arrow points at.")
  target!: SceneObject
  @ui.group_end

  @ui.group_start("Settings")
  @input
  @hint("Half view angle in degrees. Outside this angle the target counts as out of view.")
  @widget(new SliderWidget(10, 45, 1))
  viewHalfAngle: number = 14

  @input
  @hint("Distance from the eyes to the arrow in cm.")
  @widget(new SliderWidget(30, 100, 1))
  distanceCm: number = 55

  @input
  @hint("How fast the arrow follows the gaze.")
  @widget(new SliderWidget(0.5, 8, 0.1))
  followSpeed: number = 3
  @ui.group_end

  readonly onBecameOutOfView = new Event<void>()

  private active = false
  private wasOutOfView = false
  private placed = false

  onAwake() {
    const visual = this.arrow.getChild(0).getComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = buildArrow(ARROW_BAR_CM, ARROW_TIP_Z_CM, ARROW_HALF_SPAN_CM, ARROW_TAIL_Z_CM)
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  /** True while the arrow is on, because its target is outside the view angle. */
  get targetOutOfView(): boolean {
    return this.wasOutOfView
  }

  setActive(active: boolean): void {
    this.active = active
    if (!active) {
      this.arrow.enabled = false
      this.wasOutOfView = false
      this.placed = false
    }
  }

  private tick(): void {
    if (!this.active) return
    const cam = this.cameraObject.getTransform()
    const camPos = cam.getWorldPosition()
    // Camera looks along its local -Z. cam.forward is +Z in Lens Studio.
    const gaze = cam.forward.uniformScale(-1)
    const toTarget = this.target.getTransform().getWorldPosition().sub(camPos).normalize()
    const cos = Math.max(-1, Math.min(1, gaze.dot(toTarget)))
    const outOfView = Math.acos(cos) * MathUtils.RadToDeg > this.viewHalfAngle

    if (outOfView !== this.wasOutOfView) {
      this.wasOutOfView = outOfView
      this.arrow.enabled = outOfView
      if (outOfView) this.onBecameOutOfView.invoke()
    }
    if (!outOfView) return

    const t = this.arrow.getTransform()
    const desired = camPos.add(gaze.uniformScale(this.distanceCm)).sub(cam.up.uniformScale(BELOW_GAZE_CM))
    if (!this.placed) {
      t.setWorldPosition(desired)
      this.placed = true
    } else {
      t.setWorldPosition(vec3.lerp(t.getWorldPosition(), desired, Math.min(1, getDeltaTime() * this.followSpeed)))
    }
    const dir = this.target.getTransform().getWorldPosition().sub(t.getWorldPosition()).normalize()
    t.setWorldRotation(quat.lookAt(dir, vec3.up()))
  }
}
