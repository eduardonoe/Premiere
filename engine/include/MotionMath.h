#pragma once

#include <cmath>
#include "MotionParams.h"

namespace PremiereMotion {

inline float clamp01(float value) {
    if (value < 0.0f) return 0.0f;
    if (value > 1.0f) return 1.0f;
    return value;
}

inline float smoothstep01(float t) {
    t = clamp01(t);
    return t * t * (3.0f - 2.0f * t);
}

inline float normalizedProgressIn(int64_t frameTicks, int64_t clipStartTicks, double ticksPerFrame, int32_t durationFrames) {
    if (durationFrames <= 0 || ticksPerFrame <= 0.0) return 1.0f;
    const double elapsedFrames = static_cast<double>(frameTicks - clipStartTicks) / ticksPerFrame;
    return clamp01(static_cast<float>(elapsedFrames / static_cast<double>(durationFrames)));
}

inline float normalizedProgressOut(int64_t frameTicks, int64_t clipEndTicks, double ticksPerFrame, int32_t durationFrames) {
    if (durationFrames <= 0 || ticksPerFrame <= 0.0) return 0.0f;
    const double remainingFrames = static_cast<double>(clipEndTicks - frameTicks) / ticksPerFrame;
    return 1.0f - clamp01(static_cast<float>(remainingFrames / static_cast<double>(durationFrames)));
}

inline float springValue(float t, float damping, float frequency) {
    t = clamp01(t);
    const float d = damping <= 0.0f ? 0.001f : damping;
    const float f = frequency <= 0.0f ? 1.0f : frequency;
    const float decay = std::exp(-d * 8.0f * t);
    const float wave = std::cos(f * 6.28318530718f * t);
    return 1.0f - decay * wave;
}

inline float overshootValue(float t, float overshoot) {
    t = clamp01(t);
    const float s = overshoot <= 0.0f ? 1.70158f : 1.70158f + overshoot * 2.0f;
    const float x = t - 1.0f;
    return 1.0f + x * x * ((s + 1.0f) * x + s);
}

inline float bounceOutValue(float t) {
    t = clamp01(t);
    if (t < 1.0f / 2.75f) {
        return 7.5625f * t * t;
    }
    if (t < 2.0f / 2.75f) {
        t -= 1.5f / 2.75f;
        return 7.5625f * t * t + 0.75f;
    }
    if (t < 2.5f / 2.75f) {
        t -= 2.25f / 2.75f;
        return 7.5625f * t * t + 0.9375f;
    }
    t -= 2.625f / 2.75f;
    return 7.5625f * t * t + 0.984375f;
}

inline float evaluatePreset(MotionPreset preset, float t, float damping, float frequency, float overshoot) {
    switch (preset) {
        case MotionPreset::Spring:
            return springValue(t, damping, frequency);
        case MotionPreset::Overshoot:
            return overshootValue(t, overshoot);
        case MotionPreset::Bounce:
            return bounceOutValue(t);
        case MotionPreset::Pop:
            return overshootValue(t, overshoot);
        case MotionPreset::Slide:
            return smoothstep01(t);
        case MotionPreset::RotateOvershoot:
            return overshootValue(t, overshoot);
        case MotionPreset::FadeMotion:
            return smoothstep01(t);
        case MotionPreset::None:
        default:
            return 1.0f;
    }
}

inline MotionState evaluateMotionState(const MotionParams& params, const ClipTiming& timing) {
    MotionState state{};
    state.progressIn = normalizedProgressIn(timing.frameTicks, timing.clipStartTicks, timing.ticksPerFrame, params.durationFramesIn);
    state.progressOut = normalizedProgressOut(timing.frameTicks, timing.clipEndTicks, timing.ticksPerFrame, params.durationFramesOut);

    const float inValue = evaluatePreset(params.preset, state.progressIn, params.damping, params.frequency, params.overshoot);
    const float outValue = evaluatePreset(params.preset, state.progressOut, params.damping, params.frequency, params.overshoot);

    switch (params.trigger) {
        case MotionTrigger::In:
            state.weightIn = 1.0f;
            state.weightOut = 0.0f;
            state.value = inValue;
            break;
        case MotionTrigger::Out:
            state.weightIn = 0.0f;
            state.weightOut = 1.0f;
            state.value = outValue;
            break;
        case MotionTrigger::Both:
        default:
            state.weightIn = 1.0f - state.progressOut;
            state.weightOut = state.progressOut;
            state.value = (inValue * state.weightIn) + (outValue * state.weightOut);
            break;
    }

    return state;
}

} // namespace PremiereMotion
