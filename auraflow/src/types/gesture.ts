/**
 * gesture.ts
 * Shared type definitions for gesture feature data.
 * Produced by GestureAnalyzer, consumed by MappingEngine.
 */

/**
 * Semantic gesture features extracted from raw MediaPipe landmarks.
 * All numeric values are normalized to the [0, 1] range unless noted.
 */
export interface GestureFeatures {
  /**
   * Vertical position of the hand in the camera frame.
   * 0 = top of frame, 1 = bottom of frame.
   * Typically mapped to volume or gain.
   */
  heightNormalized: number;

  /**
   * How open the hand is, measured as the spread between
   * thumb tip and pinky tip.
   * 0 = fully closed, 1 = fully open.
   */
  openness: number;

  /**
   * Pinch strength between index finger tip and thumb tip.
   * 0 = fingers apart, 1 = fully pinched.
   */
  pinchStrength: number;

  /**
   * Whether the hand is in a fist pose.
   * Detected when all fingertip-to-wrist distances fall below a threshold.
   * Used as a discrete mute/pause trigger.
   */
  isFist: boolean;
}

/**
 * Nullable variant used during the hand-lost state,
 * when no landmarks are present in the current frame.
 */
export type MaybeGestureFeatures = GestureFeatures | null;