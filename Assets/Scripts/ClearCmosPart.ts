// ClearCmosPart.ts
// Owns: one pinchable PC part: its collider, SIK Interactable, hover outline, next-step ring,
//       move-away / return animation, and optional drag.
// Inputs: collider size, decoy flag, move offset, label offset, refusal text.
// Must not: decide whether a pinch is allowed. It reports pinches; ClearCmosMain decides.
// The SceneObject stays at unit scale (colliders break on scaled nodes). Visuals are children.

import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import animate, { CancelFunction } from "SpectaclesInteractionKit.lspkg/Utils/animate"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { buildCage, buildSolidBox, buildThinRing, buildWallRing } from "./ClearCmosMeshKit"

export type HoverKind = "next" | "decoy" | "none"

/** One array for every slab test, so the test does not build one per call. */
const AXES = ["x", "y", "z"] as const
const NEXT_GREEN = new vec4(0.42, 1, 0.62, 1)
const RED = new vec4(1, 0.239, 0.29, 0.6)
const AIM = new vec4(0.42, 1, 0.62, 0.45)
const NO_GO_RED = new vec3(1, 0.239, 0.29)
const NO_GO_IDLE_ALPHA = 0.14
const NO_GO_NEAR_ALPHA = 0.55
/** The one decoy the user is about to meet: it rests visibly red, so the wrong choice reads before any reach. */
const NO_GO_CURRENT_ALPHA = 0.5
const NO_GO_FLASH_ALPHA = 0.95
/** The early warning fills its box with this much Danger red, so it reads as a warning and not as a thin line. */
const NO_GO_WARNING_FILL_ALPHA = 0.5
/** Only the early warning raises this wall. The refusal on a pinch shakes instead, so the two read differently. */
const NO_GO_WALL_ALPHA = 0.55
const NO_GO_WALL_RISE_SECONDS = 0.2
/** How far the wall stands above the top of the no-go box. */
const NO_GO_WALL_ABOVE_BOX_CM = 3
/** The wall sits just outside the cage, so its faces do not sit on the cage bars. */
const NO_GO_WALL_FOOTPRINT = 1.08
const FLASH_DECAY_SECONDS = 0.25
const RING_WAIT_SECONDS = 0.35
const RING_IN_SECONDS = 0.65
const RING_OUT_SECONDS = 0.3
const RING_START_SCALE = 1.15
/** Same as the DRAM halo: about 0.56 cycles per second, well under the 3 per second flash limit (WCAG 2.3.1). */
export const RING_PULSE_LOOP_SECONDS = 1.8
/** The gentle blink never goes dark. A thin ring is far below the large-flash area at 85 cm. */
const RING_PULSE_MIN_ALPHA = 0.35
/** The pulse starts when the fade-in ends, so the next-step arrow can bob in phase with it. */
export const RING_PULSE_START_SECONDS = RING_WAIT_SECONDS + RING_IN_SECONDS
const OUTLINE_RADIUS_CM = 4
const OUTLINE_WIDTH_CM = 0.12
const HOVER_OUTLINE_BAR_CM = 0.08
const NO_GO_BAR_CM = 0.1
const REFUSAL_SECONDS = 0.3
const SHAKE_CM = 0.8
const SHAKE_RADIANS_PER_SECOND = 60
const NO_GO_RENDER_ORDER = 12
/** Above the amber X-ray callout (13) and the contact visuals (14), so a ring on a callout target is not lost under them. */
const RING_OVER_CALLOUT_RENDER_ORDER = 15
/** A callout target is drawn near the board, so its ring sits on the callout, not above its collider. */
const RING_CALLOUT_LIFT_CM = 0.4
const RING_CALLOUT_WIDTH_CM = 0.2

@component
export class ClearCmosPart extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClearCmosPart – one pinchable part</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Collider size in cm. Keep each axis at 3 cm or more for pinch targets.")
  colliderSize: vec3 = new vec3(4, 4, 4)

  @input
  @hint("Decoy parts show a red outline on hover and refuse every pinch.")
  decoy: boolean = false

  @input
  @hint("Allow drag with InteractableManipulation (used by the battery).")
  draggable: boolean = false

  @input
  @hint("Local offset in cm applied when the part moves away.")
  moveOffset: vec3 = new vec3(0, 0, 0)

  @input
  @hint("Refusal line for this part. Empty uses the generic refusal line.")
  refusalText: string = ""

  @input
  @hint("Offset in cm from the part origin to its pinch target, used when the real part is too small to pinch and the target lives in a magnified callout.")
  targetOffset: vec3 = new vec3(0, 0, 0)
  @ui.group_end

  readonly onPinched = new Event<ClearCmosPart>()
  readonly onDragStarted = new Event<ClearCmosPart>()
  readonly onDragEnded = new Event<ClearCmosPart>()
  readonly onHoverDecoy = new Event<ClearCmosPart>()

  hoverKind: HoverKind = "none"
  private ring: SceneObject
  private ringMat: Material
  private ringOn = false
  private ringOnSince = -1
  /** Reused, so the pulse allocates nothing per frame. */
  private ringPulseColor = new vec4(NEXT_GREEN.r, NEXT_GREEN.g, NEXT_GREEN.b, 1)
  private cancelRing: CancelFunction | null = null
  private outline: SceneObject
  private outlineMat: Material
  private interactable: Interactable
  private collider: ColliderComponent
  private manipulation: InteractableManipulation | null = null
  private home: vec3
  private cancelMove: CancelFunction | null = null
  private noGoBox: SceneObject
  private noGoMat: Material
  private noGoFill: SceneObject
  private noGoFillMat: Material
  private noGoFillColor = new vec4(NO_GO_RED.x, NO_GO_RED.y, NO_GO_RED.z, 0)
  private noGoBarWidthCm = NO_GO_BAR_CM
  /** True while the early warning, or a refusal of the current decoy, owns the box, so the fill shows during its hold and its decay. */
  private noGoWarning = false
  private noGoWall: SceneObject
  private noGoWallMat: Material
  private noGoWallColor = new vec4(NO_GO_RED.x, NO_GO_RED.y, NO_GO_RED.z, 0)
  /** Reused, so raising the wall allocates nothing per frame. */
  private noGoWallScale = new vec3(1, 0, 1)
  private noGoWallFullHeightCm = 0
  private noGoWallUp = false
  private noGoArmed = false
  private noGoCurrent = false
  private noGoProximity = 0
  private noGoFlashing = false
  private noGoAlpha = -1
  private cancelRefusal: CancelFunction | null = null
  private cancelDecay: CancelFunction | null = null
  private noGoDecay = 0
  private ringRadius = 1
  private shakeBase: vec3 | null = null

  onAwake() {
    this.home = this.getTransform().getLocalPosition()
    const collider = this.createColliderHost().createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = this.colliderSize
    collider.shape = shape
    collider.fitVisual = false
    this.collider = collider
    this.interactable = this.sceneObject.createComponent(Interactable.getTypeName()) as Interactable
    if (this.draggable) {
      this.manipulation = this.sceneObject.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
      this.manipulation.setCanRotate(false)
      this.manipulation.setCanScale(false)
      this.manipulation.enableYTranslation = false
      this.manipulation.setCanTranslate(false)
    }
    this.createEvent("UpdateEvent").bind(() => this.pulseRing())
    this.createEvent("OnStartEvent").bind(() => {
      this.interactable.onHoverEnter.add(() => this.showHover(true))
      this.interactable.onHoverExit.add(() => this.showHover(false))
      this.interactable.onTriggerEnd.add(() => this.onPinched.invoke(this))
      if (this.manipulation) {
        // A re-grab during the return animation stops the animation, so the two do not fight (B3).
        this.manipulation.onManipulationStart.add(() => {
          this.stopMove()
          this.onDragStarted.invoke(this)
        })
        this.manipulation.onManipulationEnd.add(() => this.onDragEnded.invoke(this))
      }
    })
  }

  /** A part with a target offset carries its collider on a child at that offset. Interactable finds it by walking the hierarchy. */
  private createColliderHost(): SceneObject {
    if (this.targetOffset.length < 0.0001) return this.sceneObject
    const host = global.scene.createSceneObject("PinchTarget")
    host.setParent(this.sceneObject)
    host.getTransform().setLocalPosition(this.targetOffset)
    return host
  }

  /** Called once by ClearCmosMain in onAwake to build the ring, outline, and no-go cages. */
  configure(overlayMaterial: Material, noGoBarCm: number = NO_GO_BAR_CM): void {
    this.ringMat = overlayMaterial.clone()
    const fullRadius = Math.max(this.colliderSize.x, this.colliderSize.z) * 0.75
    const radius = Math.min(fullRadius, OUTLINE_RADIUS_CM)
    const onCallout = this.targetOffset.length >= 0.0001
    const ringWidth = onCallout ? RING_CALLOUT_WIDTH_CM : OUTLINE_WIDTH_CM
    this.ring = this.makeVisual("Ring", buildThinRing(1 - ringWidth / radius), this.ringMat)
    this.ring.getTransform().setLocalPosition(this.targetOffset.add(new vec3(0, onCallout ? RING_CALLOUT_LIFT_CM : this.colliderSize.y * 0.5 + 0.4, 0)))
    this.ring.getTransform().setLocalScale(new vec3(radius, radius, radius))
    if (onCallout) {
      // A target in the callout sits under depth-off amber marks. Its ring is the next-step signal, so it draws over them.
      this.ringMat.mainPass.depthTest = false
      ;(this.ring.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).setRenderOrder(RING_OVER_CALLOUT_RENDER_ORDER)
    }
    this.ringRadius = radius
    this.outlineMat = overlayMaterial.clone()
    const outlineScale = this.colliderSize.uniformScale(1.08)
    this.outline = this.makeVisual("Outline", buildCage(outlineScale, HOVER_OUTLINE_BAR_CM), this.outlineMat)
    this.outline.getTransform().setLocalScale(outlineScale)
    this.outline.getTransform().setLocalPosition(this.targetOffset)
    this.ring.enabled = false
    this.outline.enabled = false
    this.noGoMat = overlayMaterial.clone()
    this.noGoMat.mainPass.depthWrite = false
    this.noGoMat.mainPass.depthTest = false
    // The cage is see-through, so its far edges must draw. A back-culled cage shows only thin near lines.
    this.noGoMat.mainPass.twoSided = true
    this.noGoBarWidthCm = noGoBarCm
    const noGoScale = this.colliderSize.uniformScale(1.15)
    this.noGoBox = this.makeVisual("NoGoBox", buildCage(noGoScale, noGoBarCm), this.noGoMat)
    this.noGoBox.getTransform().setLocalScale(noGoScale)
    this.noGoBox.getTransform().setLocalPosition(this.targetOffset)
    ;(this.noGoBox.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).setRenderOrder(NO_GO_RENDER_ORDER)
    this.noGoFillMat = overlayMaterial.clone()
    this.noGoFillMat.mainPass.depthWrite = false
    this.noGoFillMat.mainPass.depthTest = false
    this.noGoFillMat.mainPass.baseColor = this.noGoFillColor
    this.noGoFill = this.makeVisual("NoGoFlash", buildSolidBox(), this.noGoFillMat)
    this.noGoFill.getTransform().setLocalScale(noGoScale)
    this.noGoFill.getTransform().setLocalPosition(this.targetOffset)
    ;(this.noGoFill.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).setRenderOrder(NO_GO_RENDER_ORDER)
    this.noGoFill.enabled = false
    this.noGoWallMat = overlayMaterial.clone()
    this.noGoWallMat.mainPass.depthWrite = false
    this.noGoWallMat.mainPass.depthTest = false
    this.noGoWallMat.mainPass.twoSided = true
    this.noGoWallMat.mainPass.baseColor = this.noGoWallColor
    this.noGoWall = this.makeVisual("NoGoWall", buildWallRing(), this.noGoWallMat)
    this.noGoWallFullHeightCm = noGoScale.y + NO_GO_WALL_ABOVE_BOX_CM
    this.noGoWallScale.x = noGoScale.x * NO_GO_WALL_FOOTPRINT
    this.noGoWallScale.z = noGoScale.z * NO_GO_WALL_FOOTPRINT
    this.noGoWall.getTransform().setLocalScale(this.noGoWallScale)
    this.noGoWall.getTransform().setLocalPosition(this.targetOffset.add(new vec3(0, -noGoScale.y * 0.5, 0)))
    ;(this.noGoWall.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).setRenderOrder(NO_GO_RENDER_ORDER)
    this.noGoWall.enabled = false
    this.applyNoGo()
  }

  private makeVisual(name: string, mesh: RenderMesh, mat: Material): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.sceneObject)
    const rmv = so.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    rmv.mesh = mesh
    rmv.mainMaterial = mat
    return so
  }

  private showHover(on: boolean): void {
    if (!this.outline) return
    if (on && this.hoverKind === "none" && !this.decoy) return
    this.outline.enabled = on
    if (on) {
      this.outlineMat.mainPass.baseColor = this.hoverKind === "decoy" || this.decoy ? RED : AIM
      if (this.decoy) this.onHoverDecoy.invoke(this)
    }
  }

  /** Clears a hover outline left on after the step moved on. */
  clearHover(): void {
    if (this.outline) this.outline.enabled = false
  }

  /** Decoys show their translucent no-go box while the step allows it. Other parts only flash. */
  setNoGoArmed(on: boolean): void {
    this.noGoArmed = on && this.decoy
    if (!this.noGoArmed) this.noGoProximity = 0
    this.applyNoGo()
  }

  /** The current decoy rests at a stronger alpha than the other boxes. */
  setNoGoCurrent(on: boolean): void {
    this.noGoCurrent = on
    this.applyNoGo()
  }

  /** LEAF reads this to prove the wrong pins draw thicker bars than the other boxes. */
  get noGoBarCm(): number {
    return this.noGoBarWidthCm
  }

  get isNoGoArmed(): boolean {
    return this.noGoArmed
  }

  /** k is 0 when the cursor is far and 1 when it touches the box. */
  setNoGoProximity(k: number): void {
    if (!this.noGoArmed) return
    this.noGoProximity = Math.max(0, Math.min(1, k))
    this.applyNoGo()
  }

  /** Half the widest horizontal side, so proximity measures to the box edge. */
  get noGoRadiusCm(): number {
    return Math.max(this.colliderSize.x, this.colliderSize.z) * 0.5
  }

  /** The 0.3 s refusal: the part shakes and its no-go box flashes. Ends at the same position. */
  playRefusal(): void {
    this.stopRefusal()
    const t = this.getTransform()
    const base = t.getLocalPosition()
    this.shakeBase = base
    this.noGoFlashing = true
    // The current decoy fills on a refusal as well as on the warning. Others keep the plain box flash.
    this.noGoWarning = this.noGoCurrent
    this.applyNoGo()
    this.cancelRefusal = animate({
      duration: REFUSAL_SECONDS,
      easing: "linear",
      update: (a) => {
        const offset = SHAKE_CM * Math.sin(a * REFUSAL_SECONDS * SHAKE_RADIANS_PER_SECOND) * (1 - a) * (1 - a)
        t.setLocalPosition(base.add(new vec3(offset, 0, 0)))
      },
      ended: () => this.stopRefusal(true),
    })
  }

  /** The early warning: a red wall rises around a filled box, with no shake, held for the full minimum line time. Nothing has grabbed the part yet. */
  playWarningFlash(holdSeconds: number): void {
    this.stopRefusal()
    this.noGoFlashing = true
    this.noGoWarning = true
    this.noGoWallUp = true
    this.setNoGoWallHeight(0)
    this.applyNoGo()
    const riseShare = Math.min(1, NO_GO_WALL_RISE_SECONDS / holdSeconds)
    this.cancelRefusal = animate({
      duration: holdSeconds,
      easing: "linear",
      update: (a) => {
        const rise = Math.min(1, a / riseShare)
        const eased = 1 - (1 - rise) * (1 - rise) * (1 - rise)
        this.setNoGoWallHeight(this.noGoWallFullHeightCm * eased)
      },
      ended: () => this.stopRefusal(true),
    })
  }

  private setNoGoWallHeight(heightCm: number): void {
    this.noGoWallScale.y = heightCm
    this.noGoWall.getTransform().setLocalScale(this.noGoWallScale)
  }

  private stopRefusal(decay: boolean = false): void {
    if (this.cancelRefusal) this.cancelRefusal()
    this.cancelRefusal = null
    if (this.cancelDecay) this.cancelDecay()
    this.cancelDecay = null
    this.noGoDecay = 0
    if (this.shakeBase) this.getTransform().setLocalPosition(this.shakeBase)
    this.shakeBase = null
    this.noGoFlashing = false
    if (!decay) {
      this.noGoWarning = false
      this.noGoWallUp = false
    }
    if (decay) {
      this.noGoDecay = 1
      this.cancelDecay = animate({
        duration: FLASH_DECAY_SECONDS,
        easing: "ease-out-cubic",
        update: (a) => {
          this.noGoDecay = 1 - a
          this.applyNoGo()
        },
      })
    }
    this.applyNoGo()
  }

  private applyNoGo(): void {
    if (!this.noGoBox) return
    const idle = this.noGoCurrent ? NO_GO_CURRENT_ALPHA : NO_GO_IDLE_ALPHA
    const near = Math.max(NO_GO_NEAR_ALPHA, idle + 0.3)
    const resting = idle + (near - idle) * this.noGoProximity
    const alpha = this.noGoFlashing ? NO_GO_FLASH_ALPHA : resting + (NO_GO_FLASH_ALPHA - resting) * this.noGoDecay
    const visible = this.noGoFlashing || this.noGoArmed || this.noGoDecay > 0
    if (this.noGoBox.enabled !== visible) this.noGoBox.enabled = visible
    if (Math.abs(alpha - this.noGoAlpha) > 0.005) {
      this.noGoAlpha = alpha
      this.noGoMat.mainPass.baseColor = new vec4(NO_GO_RED.x, NO_GO_RED.y, NO_GO_RED.z, alpha)
    }
    const fillOn = this.noGoWarning && (this.noGoFlashing || this.noGoDecay > 0)
    if (this.noGoFill.enabled !== fillOn) this.noGoFill.enabled = fillOn
    if (fillOn) {
      this.noGoFillColor.a = NO_GO_WARNING_FILL_ALPHA * (this.noGoFlashing ? 1 : this.noGoDecay)
      this.noGoFillMat.mainPass.baseColor = this.noGoFillColor
    }
    const wallOn = this.noGoWallUp && (this.noGoFlashing || this.noGoDecay > 0)
    if (this.noGoWall.enabled !== wallOn) this.noGoWall.enabled = wallOn
    if (wallOn) {
      this.noGoWallColor.a = NO_GO_WALL_ALPHA * (this.noGoFlashing ? 1 : this.noGoDecay)
      this.noGoWallMat.mainPass.baseColor = this.noGoWallColor
    }
  }

  /** ClearCmosMain lets a ray that aims at the memory pass through this part. */
  setColliderEnabled(on: boolean): void {
    if (this.collider && this.collider.enabled !== on) this.collider.enabled = on
  }

  /** Slab test against this part's collider box, for a ray given in world space. */
  rayHitsCollider(start: vec3, direction: vec3, marginCm: number = 0): boolean {
    const toLocal = this.getTransform().getInvertedWorldTransform()
    const origin = toLocal.multiplyPoint(start).sub(this.targetOffset)
    const dir = toLocal.multiplyDirection(direction)
    let near = 0
    let far = Number.POSITIVE_INFINITY
    for (let i = 0; i < AXES.length; i++) {
      const axis = AXES[i]
      const half = this.colliderSize[axis] * 0.5 + marginCm
      if (Math.abs(dir[axis]) < 1e-6) {
        if (Math.abs(origin[axis]) > half) return false
        continue
      }
      const a = (-half - origin[axis]) / dir[axis]
      const b = (half - origin[axis]) / dir[axis]
      near = Math.max(near, Math.min(a, b))
      far = Math.min(far, Math.max(a, b))
      if (near > far) return false
    }
    return true
  }

  get ringVisible(): boolean {
    return this.ringOn
  }

  /** The ring object, so the next-step arrow can stand over it. */
  get ringObject(): SceneObject {
    return this.ring
  }

  get ringRadiusCm(): number {
    return this.ringRadius
  }

  /** From where the part is now to its home. The arrow uses it, so it points at the home ring while the part returns. */
  get homeOffsetWorld(): vec3 {
    return this.homeWorldPosition.sub(this.worldPosition)
  }

  /** The gentle blink on the next-step ring: alpha only, after the fade-in. Scale and ring.enabled never change here. */
  private pulseRing(): void {
    if (!this.ringOn || this.ringOnSince < 0 || !this.ring) return
    const t = getTime() - this.ringOnSince - RING_PULSE_START_SECONDS
    if (t < 0) return
    const w = 0.5 + 0.5 * Math.cos((2 * Math.PI * t) / RING_PULSE_LOOP_SECONDS)
    this.ringPulseColor.a = RING_PULSE_MIN_ALPHA + (1 - RING_PULSE_MIN_ALPHA) * w
    this.ringMat.mainPass.baseColor = this.ringPulseColor
  }

  /** The ring state changes now. Its brightness waits 350 ms, then fades in over 650 ms while it settles from 1.15x. */
  setRing(on: boolean): void {
    if (!this.ring || on === this.ringOn) return
    this.ringOn = on
    this.ringOnSince = on ? getTime() : -1
    if (this.cancelRing) this.cancelRing()
    this.ring.enabled = true
    const c = NEXT_GREEN
    const transform = this.ring.getTransform()
    const setScale = (k: number) => transform.setLocalScale(vec3.one().uniformScale(this.ringRadius * k))
    if (on) {
      this.ringMat.mainPass.baseColor = new vec4(c.r, c.g, c.b, 0)
      setScale(RING_START_SCALE)
      const total = RING_WAIT_SECONDS + RING_IN_SECONDS
      this.cancelRing = animate({
        duration: total,
        easing: "linear",
        update: (a) => {
          const p = Math.max(0, (a * total - RING_WAIT_SECONDS) / RING_IN_SECONDS)
          const eased = 1 - Math.pow(1 - p, 3)
          this.ringMat.mainPass.baseColor = new vec4(c.r, c.g, c.b, eased)
          setScale(RING_START_SCALE + (1 - RING_START_SCALE) * eased)
        },
      })
      return
    }
    const start = this.ringMat.mainPass.baseColor.a as number
    this.cancelRing = animate({
      duration: RING_OUT_SECONDS,
      easing: "ease-out-quad",
      update: (t) => {
        this.ringMat.mainPass.baseColor = new vec4(c.r, c.g, c.b, start * (1 - t))
      },
      ended: () => {
        this.ring.enabled = false
        setScale(1)
      },
    })
  }

  moveAway(): void {
    this.animateTo(this.home.add(this.moveOffset), 0.6, "ease-in-out-cubic")
  }

  returnHome(): void {
    this.animateTo(this.home, 0.8, "ease-in-out-quad")
  }

  snapTo(worldPosition: vec3): void {
    this.stopRefusal()
    this.stopMove()
    this.getTransform().setWorldPosition(worldPosition)
  }

  setDragAllowed(allowed: boolean): void {
    if (this.manipulation) this.manipulation.setCanTranslate(allowed)
  }

  /** The center of the pinch target in world space. It is the part origin unless the target is offset into a callout. */
  get targetWorldPosition(): vec3 {
    return this.getTransform().getWorldTransform().multiplyPoint(this.targetOffset)
  }

  get worldPosition(): vec3 {
    return this.getTransform().getWorldPosition()
  }

  get homeWorldPosition(): vec3 {
    const parent = this.sceneObject.getParent()
    return parent ? parent.getTransform().getWorldTransform().multiplyPoint(this.home) : this.home
  }

  /** True while a move-away or return animation is writing this part's position. */
  get isMoving(): boolean {
    return this.cancelMove !== null
  }

  private stopMove(): void {
    if (this.cancelMove) this.cancelMove()
    this.cancelMove = null
  }

  private animateTo(target: vec3, duration: number, easing: "ease-in-out-cubic" | "ease-in-out-quad"): void {
    this.stopRefusal()
    this.stopMove()
    const t = this.getTransform()
    const from = t.getLocalPosition()
    this.cancelMove = animate({
      duration,
      easing,
      update: (a) => t.setLocalPosition(vec3.lerp(from, target, a)),
      ended: () => {
        this.cancelMove = null
      },
    })
  }
}
