// ClearCmosLabelUI.ts
// Owns: one short text line on a UI Kit BackPlate.
// Used by: StepLabel, StepLabel2, RefusalLine.
// Must not: hold flow state. ClearCmosMain drives show, hide, and placement.

import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import animate, { CancelFunction } from "SpectaclesInteractionKit.lspkg/Utils/animate"

const CONTENT_Z = 0.6

@component
export class ClearCmosLabelUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClearCmosLabelUI – one text line on a panel</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Panel width in cm.")
  @widget(new SliderWidget(8, 40, 0.5))
  widthCm: number = 15

  @input
  @hint("Panel height in cm.")
  @widget(new SliderWidget(3, 12, 0.5))
  heightCm: number = 4

  @input
  @hint("Text size. 88 is about 2 cm tall.")
  @widget(new SliderWidget(40, 120, 1))
  textSize: number = 88

  @input("vec4", "{1, 1, 1, 1}")
  @hint("Text color.")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(1, 1, 1, 1)

  @input
  @hint("Draws the panel behind the text. A secondary line turns it off, so it reads as a line and not as a second card.")
  showPlate: boolean = true
  @ui.group_end

  private text: Text
  private cancelFade: CancelFunction | null = null

  onAwake() {
    this.sceneObject.createComponent("Component.Canvas")
    if (this.showPlate) {
      const plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
      plate.size = new vec2(this.widthCm, this.heightCm)
    }

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    this.text = content.createComponent("Component.Text") as Text
    this.text.text = ""
    this.text.size = this.textSize
    this.text.depthTest = true
    this.text.horizontalAlignment = HorizontalAlignment.Center
    this.text.verticalAlignment = VerticalAlignment.Center
    this.text.horizontalOverflow = HorizontalOverflow.Wrap
    this.text.verticalOverflow = VerticalOverflow.Overflow
    this.text.layoutRect = Rect.create(-this.widthCm / 2 + 0.5, this.widthCm / 2 - 0.5, -this.heightCm / 2, this.heightCm / 2)
    this.text.textFill.color = this.textColor
  }

  /** Changes the text size without changing the configured textSize. */
  setTextSize(size: number): void {
    this.text.size = size
  }

  get textValue(): string {
    return this.text ? this.text.text : ""
  }

  /** Shows the text and fades it in over fadeSeconds. Zero shows it at once. */
  show(message: string, fadeSeconds: number, color: vec4 = this.textColor): void {
    this.sceneObject.enabled = true
    this.disablePlateCollider()
    this.text.text = message
    if (this.cancelFade) this.cancelFade()
    const c = color
    if (fadeSeconds <= 0) {
      this.text.textFill.color = c
      return
    }
    this.cancelFade = animate({
      duration: fadeSeconds,
      easing: "ease-out-quad",
      update: (t) => {
        this.text.textFill.color = new vec4(c.r, c.g, c.b, c.a * t)
      },
    })
  }

  /** A label is read, not pinched, so its panel must not catch the cursor ray. */
  private disablePlateCollider(): void {
    const colliders = this.sceneObject.getComponents("Physics.ColliderComponent") as ColliderComponent[]
    for (const collider of colliders) collider.enabled = false
  }

  hide(): void {
    if (this.cancelFade) this.cancelFade()
    this.sceneObject.enabled = false
  }

  placeAt(worldPosition: vec3): void {
    this.getSceneObject().getTransform().setWorldPosition(worldPosition)
  }
}
