// ClearCmosMonitorUI.ts
// Owns: the text on MonitorScreen. The Text component sits on this named object so tests can read it.
// Must not: decide what to show. ClearCmosMain pushes the text.

@component
export class ClearCmosMonitorUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">ClearCmosMonitorUI – monitor text</span>')
  @ui.separator
  @ui.group_start("Settings")
  @input
  @hint("Screen text before the fix.")
  noSignalText: string = "No signal"

  @input
  @hint("Screen text after power on.")
  bootLine: string = "Booting..."

  @input
  @hint("Monitor text size.")
  @widget(new SliderWidget(60, 400, 1))
  textSize: number = 180

  @input("vec4", "{1, 1, 1, 1}")
  @hint("Monitor text color.")
  @widget(new ColorWidget())
  textColor: vec4 = new vec4(1, 1, 1, 1)

  @input
  @hint("How far below the screen center the boot line sits, in cm. Only the lower part of the screen is inside the working view.")
  @widget(new SliderWidget(0, 12, 0.5))
  bootLineDropCm: number = 9.5
  @ui.group_end

  private text: Text
  private homeLocalPosition: vec3

  onAwake() {
    this.text = this.sceneObject.createComponent("Component.Text") as Text
    this.text.size = this.textSize
    this.text.depthTest = true
    this.text.horizontalAlignment = HorizontalAlignment.Center
    this.text.verticalAlignment = VerticalAlignment.Center
    this.text.horizontalOverflow = HorizontalOverflow.Wrap
    this.text.verticalOverflow = VerticalOverflow.Overflow
    this.text.layoutRect = Rect.create(-23, 23, -12, 12)
    this.text.textFill.color = this.textColor
    this.homeLocalPosition = this.getTransform().getLocalPosition()
    this.showNoSignal()
  }

  get textValue(): string {
    return this.text ? this.text.text : ""
  }

  showNoSignal(): void {
    this.text.text = this.noSignalText
    this.getTransform().setLocalPosition(this.homeLocalPosition.add(new vec3(0, -this.bootLineDropCm, 0)))
  }

  showBoot(): void {
    this.text.text = this.bootLine
    this.getTransform().setLocalPosition(this.homeLocalPosition.add(new vec3(0, -this.bootLineDropCm, 0)))
  }
}
