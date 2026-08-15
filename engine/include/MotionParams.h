#pragma once

#include <stdint.h>

namespace PremiereMotion {

enum class MotionPreset : int32_t {
    None = 0,
    Spring = 1,
    Overshoot = 2,
    Bounce = 3,
    Pop = 4,
    Slide = 5,
    RotateOvershoot = 6,
    FadeMotion = 7
};

enum class MotionTrigger : int32_t {
    In = 0,
    Out = 1,
    Both = 2
};

enum class MotionTarget : int32_t {
    Position = 0,
    Scale = 1,
    Rotation = 2,
    Opacity = 3,
    Transform = 4
};

enum class MotionAxis : int32_t {
    X = 0,
    Y = 1,
    XY = 2
};

struct MotionParams {
    MotionPreset preset;
    MotionTrigger trigger;
    MotionTarget target;
    MotionAxis axis;

    int32_t enabled;
    int32_t durationFramesIn;
    int32_t durationFramesOut;

    float amplitude;
    float damping;
    float frequency;
    float overshoot;

    float positionX;
    float positionY;
    float scale;
    float rotationDegrees;
    float opacity;

    float anchorX;
    float anchorY;

    int32_t preserveUserTransform;
    int32_t reserved0;
    int32_t reserved1;
    int32_t reserved2;
};

struct ClipTiming {
    int64_t clipStartTicks;
    int64_t clipEndTicks;
    int64_t frameTicks;
    double ticksPerFrame;
};

struct MotionState {
    float progressIn;
    float progressOut;
    float weightIn;
    float weightOut;
    float value;
};

} // namespace PremiereMotion
