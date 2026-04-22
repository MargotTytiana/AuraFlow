/**
 * math.ts
 * Shared math utility functions used across gesture analysis and audio mapping.
 * Focuses on smoothing, normalization, and value remapping.
 */

/**
 * Clamps a value to the inclusive range [min, max].
 *
 * @param v   - Input value
 * @param min - Lower bound (default 0)
 * @param max - Upper bound (default 1)
 */
export const clamp = (v: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, v));

/**
 * Creates an Exponential Moving Average (EMA) smoother.
 *
 * Reduces jitter in raw gesture data so that audio parameters
 * change gradually rather than jumping on every frame.
 *
 * Formula: current = alpha * target + (1 - alpha) * current
 *
 * @param alpha - Smoothing factor in (0, 1].
 *                Lower = smoother but slower to respond.
 *                Higher = more responsive but noisier.
 *                Recommended range: 0.05 (very smooth) ~ 0.2 (responsive)
 *
 * @returns A stateful updater function. Call it each frame with the
 *          latest raw value; it returns the smoothed output.
 *
 * @example
 * const smoothHeight = ema(0.1);
 * // inside animation loop:
 * const smoothed = smoothHeight(rawLandmark.y);
 */
export const ema = (alpha: number): ((target: number) => number) => {
  let current = 0;
  let initialized = false;

  return (target: number): number => {
    // Seed with the first value to avoid a slow ramp-up from 0
    if (!initialized) {
      current = target;
      initialized = true;
    } else {
      current = alpha * target + (1 - alpha) * current;
    }
    return current;
  };
};

/**
 * Linearly remaps a value from one range to another.
 *
 * Useful for converting normalized gesture features (0~1)
 * into concrete audio parameter ranges (e.g. filter frequency 200~4000 Hz).
 *
 * @param v      - Input value
 * @param inMin  - Input range lower bound
 * @param inMax  - Input range upper bound
 * @param outMin - Output range lower bound
 * @param outMax - Output range upper bound
 *
 * @example
 * // Map hand height (0~1) to filter frequency (200~4000 Hz)
 * const freq = lerp(height, 0, 1, 200, 4000);
 */
export const lerp = (
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);

/**
 * Logarithmic remap from [0, 1] to [outMin, outMax].
 *
 * Human perception of loudness and frequency is roughly logarithmic,
 * so this produces more natural-feeling mappings for audio parameters
 * than a straight linear scale.
 *
 * @param v      - Normalized input in [0, 1]
 * @param outMin - Output range lower bound (must be > 0)
 * @param outMax - Output range upper bound
 *
 * @example
 * // Map pinch (0~1) to filter cutoff with perceptual scaling
 * const freq = logLerp(pinch, 200, 8000);
 */
export const logLerp = (v: number, outMin: number, outMax: number): number => {
  const clamped = clamp(v);
  return outMin * Math.pow(outMax / outMin, clamped);
};

/**
 * Returns true if a value has changed beyond a threshold since the last call.
 *
 * Used to avoid unnecessary audio parameter updates when the hand is nearly still,
 * reducing CPU load from frequent Web Audio API calls.
 *
 * @param threshold - Minimum change required to trigger (default 0.005)
 *
 * @example
 * const hasChanged = createDeltaGuard(0.01);
 * if (hasChanged(smoothedHeight)) audio.setNoiseGain(smoothedHeight);
 */
export const createDeltaGuard = (threshold = 0.005): ((v: number) => boolean) => {
  let last = NaN;
  return (v: number): boolean => {
    if (Math.abs(v - last) > threshold) {
      last = v;
      return true;
    }
    return false;
  };
};