// Shared math utilities to reduce duplication across systems.

export class MathUtils {
  // Clamp value between min and max.
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  // Normalize value from input range to output range.
  static normalize(
    value: number,
    inMin: number,
    inMax: number,
    outMin = 0,
    outMax = 1,
  ): number {
    const ratio = MathUtils.clamp((value - inMin) / (inMax - inMin), 0, 1);
    return outMin + ratio * (outMax - outMin);
  }

  // Linear interpolation between two values.
  static lerp(from: number, to: number, t: number): number {
    return from + (to - from) * MathUtils.clamp(t, 0, 1);
  }

  // Smooth interpolation using smoothstep curve.
  static smoothstep(edge0: number, edge1: number, x: number): number {
    const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // Distance between two points.
  static distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Normalize angle to range [-PI, PI].
  static normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  // Safe division (returns fallback if divisor is zero).
  static safeDivide(numerator: number, divisor: number, fallback = 0): number {
    return divisor !== 0 ? numerator / divisor : fallback;
  }
}
