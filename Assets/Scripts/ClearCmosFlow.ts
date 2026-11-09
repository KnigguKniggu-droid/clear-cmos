// ClearCmosFlow.ts
// Owns: the ordered step list of the Clear CMOS repair. Pure data, no scene access.
// Must not: touch SceneObjects or UI. ClearCmosMain owns the current step value.

export enum Step {
  Symptom,
  Anchor,
  PowerCord,
  Glass,
  Fix,
  Wait,
  Rebuild,
  PowerOn,
  Training,
  Done,
}
