// ClearCmosWaitCardUI.ts
// Owns: the Wait card panel above the socket: countdown, real-wait note, and one explanation line.
// Must not: run the timer. ClearCmosMain pushes the remaining seconds.

import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexAlign, FlexAlignSelf, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"

const CONTENT_Z = 0.6

@component
export class ClearCmosWaitCardUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClearCmosWaitCardUI – countdown card</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Card width in cm.")
  @widget(new SliderWidget(16, 40, 0.5))
  widthCm: number = 22

  @input
  @hint("Card height in cm.")
  @widget(new SliderWidget(10, 30, 0.5))
  heightCm: number = 13

  @input
  @hint("Note line below the countdown.")
  realWaitText: string = "Time-lapsed."

  @input
  @hint("Explanation line.")
  explanationText: string = "Clears saved BIOS settings."
  @ui.group_end

  private countdown: Text
  private shownSeconds = -1
  /** How many times the countdown text was written. LEAF reads this to prove it is not per frame (B5). */
  private countdownWrites = 0

  onAwake() {
    this.sceneObject.createComponent("Component.Canvas")
    const plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(this.widthCm, this.heightCm)

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    const w = this.widthCm - 2
    const h = this.heightCm - 2
    flex.onInitialized.add(() => {
      flex.width = w
      flex.height = h
      flex.direction = FlexDirection.Column
      flex.rowGap = 0.3
      flex.justifyContent = FlexJustify.Center
      flex.alignItems = FlexAlign.Stretch
    })
    this.countdown = this.addRow(content, "10", 120, 4)
    this.addRow(content, this.realWaitText, 60, 2)
    this.addRow(content, this.explanationText, 50, 3.2)
  }

  setRemaining(seconds: number): void {
    if (!this.countdown) return
    const whole = Math.ceil(Math.max(0, seconds))
    if (whole === this.shownSeconds) return
    this.shownSeconds = whole
    this.countdownWrites++
    this.countdown.text = whole + " s"
  }

  private addRow(parent: SceneObject, value: string, size: number, heightCm: number): Text {
    const row = global.scene.createSceneObject("Row")
    row.setParent(parent)
    const item = row.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideHeight = heightCm
    item.alignSelf = FlexAlignSelf.Stretch
    item.flexShrink = 0
    const text = row.createComponent("Component.Text") as Text
    text.text = value
    text.size = size
    text.depthTest = true
    text.horizontalAlignment = HorizontalAlignment.Center
    text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = HorizontalOverflow.Wrap
    text.verticalOverflow = VerticalOverflow.Overflow
    text.layoutRect = Rect.create(-(this.widthCm - 2) / 2, (this.widthCm - 2) / 2, -heightCm / 2, heightCm / 2)
    text.textFill.color = new vec4(1, 1, 1, 1)
    return text
  }
}
