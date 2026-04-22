/**
 * GestureAnalyzer.ts
 * Transforms raw MediaPipe landmark arrays into semantic gesture features.
 *
 * Responsibilities:
 *  - Computing meaningful scalar features from 21 hand keypoints
 *  - Smoothing each feature independently via EMA to suppress jitter
 *  - Detecting discrete poses such as fist
 *  - Outputting a clean GestureFeatures object each frame
 *
 * This module has no knowledge of cameras, audio, or UI.
 * It is a pure data transformer: NormalizedLandmark[] → GestureFeatures.
 */

import type { NormalizedLandmark } from '@mediapipe/hands';
import type { GestureFeatures, MaybeGestureFeatures } from '../types/gesture';
import { clamp, ema } from '../utils/math';

// ─── Landmark index constants ─────────────────────────────────────────────────
// Named constants prevent magic numbers and make intent explicit.

const WRIST       = 0;
const THUMB_TIP   = 4;
const INDEX_TIP   = 8;
const MIDDLE_MCP  = 9;   // mid-palm anchor for height calculation
const RING_TIP    = 16;
const PINKY_TIP   = 20;

/** All five fingertip indices, used for fist detection. */
const FINGERTIP_INDICES = [THUMB_TIP, INDEX_TIP, 12, RING_TIP, PINKY_TIP] as const;

// ─── Tuning constants ─────────────────────────────────────────────────────────

/**
 * Divisor used to normalise the raw thumb-to-pinky spread into [0, 1].
 * Empirically calibrated against a fully open adult hand at arm's length.
 * Adjust if the gesture feels under- or over-sensitive.
 */
const OPENNESS_SCALE = 0.5;

/**
 * Divisor used to normalise the raw index-to-thumb distance into [0, 1].
 * At this distance the pinch is considered fully released (strength = 0).
 */
const PINCH_SCALE = 0.15;

/**
 * Sum-of-fingertip-distances threshold below which the hand is considered
 * a fist. Coordinates are in MediaPipe's normalised [0, 1] space.
 * Lower = requires a tighter fist to trigger.
 */
const FIST_THRESHOLD = 0.8;

// ─── GestureAnalyzer ─────────────────────────────────────────────────────────

export class GestureAnalyzer {
  /**
   * Independent EMA smoothers for each continuous feature.
   * Separate alphas let each axis respond at its own rate:
   *  - Height and openness track broad, deliberate movements → moderate alpha
   *  - Pinch tracks fine motor control → slightly faster response
   */
  private readonly smooth = {
    height:   ema(0.1),
    openness: ema(0.1),
    pinch:    ema(0.12),
  };

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Extracts and smooths gesture features from a single frame's landmarks.
   *
   * @param lm - 21-point NormalizedLandmark array from MediaPipe Hands.
   *             Coordinates are in [0, 1] relative to the video frame.
   * @returns  A fully populated GestureFeatures object.
   */
  extract(lm: NormalizedLandmark[]): GestureFeatures {
    return {
      heightNormalized: this.computeHeight(lm),
      openness:         this.computeOpenness(lm),
      pinchStrength:    this.computePinch(lm),
      isFist:           this.detectFist(lm),
    };
  }

  /**
   * Convenience wrapper that returns null when no landmarks are present.
   * Allows callers to use a single nullable type rather than a separate
   * hand-lost code path.
   *
   * @param lm - Raw landmark array, or null/undefined when hand is absent.
   */
  extractOrNull(lm: NormalizedLandmark[] | null | undefined): MaybeGestureFeatures {
    if (!lm?.length) return null;
    return this.extract(lm);
  }

  /**
   * Resets all EMA smoothers to their uninitialised state.
   * Call this when a hand is lost so the next detection starts fresh
   * rather than interpolating from a stale previous position.
   */
  reset(): void {
    this.smooth.height   = ema(0.1);
    this.smooth.openness = ema(0.1);
    this.smooth.pinch    = ema(0.12);
  }

  // ─── Feature computations ────────────────────────────────────────────────────

  /**
   * Computes the vertical position of the hand in the frame.
   *
   * Uses the average of wrist and middle-MCP y-coordinates as a stable
   * palm anchor — more robust than a single point against finger movement.
   *
   * Result: 0 = top of frame (hand raised), 1 = bottom of frame (hand lowered).
   * MappingEngine typically inverts this so raising the hand increases volume.
   */
  private computeHeight(lm: NormalizedLandmark[]): number {
    const raw = (lm[WRIST].y + lm[MIDDLE_MCP].y) / 2;
    return this.smooth.height(clamp(raw));
  }

  /**
   * Computes how open the hand is, based on the Euclidean distance
   * between thumb tip and pinky tip.
   *
   * Result: 0 = fully closed / cupped, 1 = fully spread open.
   */
  private computeOpenness(lm: NormalizedLandmark[]): number {
    const dx  = lm[THUMB_TIP].x - lm[PINKY_TIP].x;
    const dy  = lm[THUMB_TIP].y - lm[PINKY_TIP].y;
    const raw = Math.hypot(dx, dy) / OPENNESS_SCALE;
    return this.smooth.openness(clamp(raw));
  }

  /**
   * Computes pinch strength as the closeness of index finger tip to thumb tip.
   *
   * Inverted so that touching fingers = 1 (full pinch) and
   * fingers apart = 0 (no pinch), matching an intuitive "squeeze" metaphor.
   */
  private computePinch(lm: NormalizedLandmark[]): number {
    const dx  = lm[INDEX_TIP].x - lm[THUMB_TIP].x;
    const dy  = lm[INDEX_TIP].y - lm[THUMB_TIP].y;
    const raw = 1 - Math.hypot(dx, dy) / PINCH_SCALE;
    return this.smooth.pinch(clamp(raw));
  }

  /**
   * Detects a fist pose by summing the distances from each fingertip
   * to the wrist. When all fingers are curled inward, this sum drops
   * below FIST_THRESHOLD.
   *
   * Not smoothed — fist is used as a discrete event (mute toggle)
   * and should respond immediately.
   */
  private detectFist(lm: NormalizedLandmark[]): boolean {
    const wrist = lm[WRIST];
    const total = FINGERTIP_INDICES.reduce((sum, idx) => {
      const dx = lm[idx].x - wrist.x;
      const dy = lm[idx].y - wrist.y;
      return sum + Math.hypot(dx, dy);
    }, 0);
    return total < FIST_THRESHOLD;
  }
}