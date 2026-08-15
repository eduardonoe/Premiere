// Bridge between the UXP panel and the native Premiere Motion Engine effect.
// This file defines the intended access pattern. Concrete Premiere UXP API calls
// must be wired against the current Adobe sample/API version during implementation.

export const MotionPreset = Object.freeze({
  NONE: 0,
  SPRING: 1,
  OVERSHOOT: 2,
  BOUNCE: 3,
  POP: 4,
  SLIDE: 5,
  ROTATE_OVERSHOOT: 6,
  FADE_MOTION: 7,
});

export const MotionTrigger = Object.freeze({
  IN: 0,
  OUT: 1,
  BOTH: 2,
});

export const MotionTarget = Object.freeze({
  POSITION: 0,
  SCALE: 1,
  ROTATION: 2,
  OPACITY: 3,
  TRANSFORM: 4,
});

export const MotionAxis = Object.freeze({
  X: 0,
  Y: 1,
  XY: 2,
});

export const MOTION_ENGINE_EFFECT_NAME = 'Premiere Motion Engine';

export function createDefaultMotionParams() {
  return {
    preset: MotionPreset.SPRING,
    trigger: MotionTrigger.IN,
    target: MotionTarget.SCALE,
    axis: MotionAxis.XY,
    enabled: true,
    durationFramesIn: 14,
    durationFramesOut: 14,
    amplitude: 1.0,
    damping: 0.55,
    frequency: 3.0,
    overshoot: 0.18,
    positionX: 0.0,
    positionY: 0.0,
    scale: 1.12,
    rotationDegrees: 0.0,
    opacity: 1.0,
    anchorX: 0.5,
    anchorY: 0.5,
    preserveUserTransform: true,
  };
}

export const builtinPresets = Object.freeze([
  {
    id: 'spring-scale-in',
    label: 'Spring Scale In',
    params: {
      ...createDefaultMotionParams(),
      preset: MotionPreset.SPRING,
      trigger: MotionTrigger.IN,
      target: MotionTarget.SCALE,
      scale: 1.12,
      damping: 0.55,
      frequency: 3.0,
    },
  },
  {
    id: 'overshoot-position-out',
    label: 'Overshoot Position Out',
    params: {
      ...createDefaultMotionParams(),
      preset: MotionPreset.OVERSHOOT,
      trigger: MotionTrigger.OUT,
      target: MotionTarget.POSITION,
      axis: MotionAxis.Y,
      positionY: -240.0,
      overshoot: 0.24,
    },
  },
  {
    id: 'bounce-rotation-in',
    label: 'Bounce Rotation In',
    params: {
      ...createDefaultMotionParams(),
      preset: MotionPreset.BOUNCE,
      trigger: MotionTrigger.IN,
      target: MotionTarget.ROTATION,
      rotationDegrees: -8.0,
      damping: 0.5,
      frequency: 2.5,
    },
  },
]);

export async function findSelectedClips() {
  // TODO: Wire to Premiere UXP sequence/timeline selection API.
  // Expected return: array of clip handles/objects from the active sequence.
  throw new Error('findSelectedClips() must be connected to the Premiere UXP API.');
}

export async function findOrApplyMotionEngineEffect(clip) {
  // TODO: Inspect clip components/effects.
  // If MOTION_ENGINE_EFFECT_NAME exists, return it.
  // Otherwise apply the native effect and return the new effect instance.
  void clip;
  throw new Error('findOrApplyMotionEngineEffect() must be connected to the Premiere UXP API.');
}

export async function writeMotionEngineParams(effect, params) {
  // TODO: Map each key in params to the native effect parameter names/IDs.
  // This must not create keyframes. It only writes static effect parameters.
  void effect;
  void params;
  throw new Error('writeMotionEngineParams() must be connected to the Premiere UXP API.');
}

export async function readMotionEngineParams(effect) {
  // TODO: Read native effect params back into the panel state.
  void effect;
  throw new Error('readMotionEngineParams() must be connected to the Premiere UXP API.');
}

export async function removeMotionEngineEffect(clip) {
  // TODO: Remove only MOTION_ENGINE_EFFECT_NAME from the selected clip.
  void clip;
  throw new Error('removeMotionEngineEffect() must be connected to the Premiere UXP API.');
}

export async function applyPresetToSelectedClips(preset) {
  const clips = await findSelectedClips();

  if (!clips.length) {
    throw new Error('Select at least one clip in the active timeline.');
  }

  for (const clip of clips) {
    const effect = await findOrApplyMotionEngineEffect(clip);
    await writeMotionEngineParams(effect, preset.params);
  }

  return clips.length;
}
