// ClearCmosActionButtonUI.ts
// Owns: one UI Kit Button on this SceneObject with a light text label.
// Used by: SymptomButton, AnchorButton, RebuildButton.
// Must not: hold flow state. It reports presses through onPressed.

import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event"

const LABEL_Z = 0.08

@component
export class ClearCmosActionButtonUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClearCmosActionButtonUI – one labelled button</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Button label.")
  labelText: string = "Button"

  @input
  @hint("Button width in cm.")
  @widget(new SliderWidget(4, 40, 0.5))
  widthCm: number = 26

  @input
  @hint("Button height in cm.")
  @widget(new SliderWidget(4, 12, 0.5))
  heightCm: number = 5

  @input
  @hint("Label text size. 88 is about 2 cm tall.")
  @widget(new SliderWidget(40, 120, 1))
  textSize: number = 70

  @input
  @hint("Hides the button plate, so only the pinch target remains. Used when the real part is the target.")
  hidePlate: boolean = false
  @ui.group_end

  readonly onPressed = new Event<void>()

  onAwake() {
    this.sceneObject.createComponent("Component.Canvas")
    const button = this.sceneObject.createComponent(Button.getTypeName()) as Button
    const size = new vec3(this.widthCm, this.heightCm, 1)
    button.size = size
    button.onInitialized.add(() => {
      button.size = size
      if (this.hidePlate) button.visual.renderMeshVisual.enabled = false
    })
    button.onTriggerUp.add(() => this.onPressed.invoke())

    const labelObject = global.scene.createSceneObject("ButtonLabel")
    labelObject.setParent(this.sceneObject)
    labelObject.getTransform().setLocalPosition(new vec3(0, 0, LABEL_Z))
    const text = labelObject.createComponent("Component.Text") as Text
    text.text = this.labelText
    text.size = this.textSize
    text.depthTest = true
    text.horizontalAlignment = HorizontalAlignment.Center
    text.verticalAlignment = VerticalAlignment.Center
    text.horizontalOverflow = HorizontalOverflow.Overflow
    text.verticalOverflow = VerticalOverflow.Overflow
    text.layoutRect = Rect.create(-this.widthCm / 2, this.widthCm / 2, -this.heightCm / 2, this.heightCm / 2)
    text.textFill.color = new vec4(1, 1, 1, 1)
  }
}
