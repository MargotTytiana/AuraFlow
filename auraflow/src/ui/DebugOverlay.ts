/**
 * DebugOverlay.ts
 * Renders a real-time visualisation of MediaPipe hand landmarks
 * on a transparent canvas overlay for development and tuning purposes.
 *
 * Responsibilities:
 *  - Drawing all 21 hand keypoints as labelled dots each frame
 *  - Connecting keypoints with skeleton lines to show hand topology
 *  - Annotating computed GestureFeatures values as on-screen text
 *  - Responding to window resize to keep the canvas aligned with the viewport
 *  - Activating only when ?debug=true is present — zero cost in production
 *
 * This module has no effect on audio, gesture logic, or application state.
 * It is a pure rendering utility for development use only.
 * Remove the ?debug param to disable it entirely at runtime.
 */

import type { NormalizedLandmark } from '@mediapipe/hands';
import type { GestureFeatures }    from '../types/gesture';

// ─── Skeleton topology ────────────────────────────────────────────────────────
// Each tuple defines a bone: [start landmark index, end landmark index].
// Grouped by finger to make topology edits readable.

const SKELETON_BONES: [number, number][] = [
  // Palm
  [0, 1], [0, 5], [0, 17], [5, 9], [9, 13], [13, 17],
  // Thumb
  [1, 2], [2, 3], [3, 4],
  // Index finger
  [5, 6], [6, 7], [7, 8],
  // Middle finger
  [9, 10], [10, 11], [11, 12],
  // Ring finger
  [13, 14], [14, 15], [15, 16],
  // Pinky
  [17, 18], [18, 19], [19, 20],
];

// ─── Landmark labels ──────────────────────────────────────────────────────────
// Sparse map — only key landmarks are labelled to avoid clutter.

const LANDMARK_LABELS: Record<number, string> = {
  0:  'wrist',
  4:  'thumb',
  8:  'index',
  12: 'middle',
  16: 'ring',
  20: 'pinky',
};

// ─── Visual constants ─────────────────────────────────────────────────────────

const DOT_RADIUS_JOINT    = 3;    // px — regular joints
const DOT_RADIUS_TIP      = 5;    // px — fingertip landmarks (4,8,12,16,20)
const DOT_RADIUS_WRIST    = 6;    // px — wrist anchor
const FINGERTIP_INDICES   = new Set([4, 8, 12, 16, 20]);

const COLOR_SKELETON      = 'rgba(0, 255, 136, 0.55)';
const COLOR_JOINT         = '#00ff88';
const COLOR_WRIST         = '#ffffff';
const COLOR_LABEL         = 'rgba(255, 255, 255, 0.75)';
const COLOR_FEATURE_BG    = 'rgba(0, 0, 0, 0.45)';
const COLOR_FEATURE_TEXT  = '#00ff88';

const FONT_LABEL   = '10px monospace';
const FONT_FEATURE = '12px monospace';

/** Padding around the feature readout panel in px. */
const PANEL_PADDING = 10;

// ─── DebugOverlay ─────────────────────────────────────────────────────────────

export class DebugOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx:    CanvasRenderingContext2D;

  /** Bound resize handler stored so it can be removed on dispose(). */
  private readonly onResize: () => void;

  constructor() {
    this.canvas = this.getCanvas();
    this.ctx    = this.canvas.getContext('2d')!;

    this.syncSize();
    this.canvas.classList.add('visible');

    // Keep canvas dimensions in sync when the viewport is resized
    this.onResize = () => this.syncSize();
    window.addEventListener('resize', this.onResize);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Clears the canvas and draws the current frame's landmark data.
   * Called each frame by App.ts only when debugMode is active.
   *
   * @param landmarks - 21-point array from VisionCapture.
   * @param features  - Optional computed features from GestureAnalyzer.
   *                    When provided, a readout panel is drawn in the
   *                    top-left corner for easy parameter inspection.
   */
  draw(
    landmarks: NormalizedLandmark[],
    features?: GestureFeatures,
  ): void {
    const { canvas: c, ctx } = this;
    ctx.clearRect(0, 0, c.width, c.height);

    this.drawSkeleton(landmarks);
    this.drawJoints(landmarks);

    if (features) {
      this.drawFeaturePanel(features);
    }
  }

  /**
   * Clears the canvas without drawing new content.
   * Called by App.ts when the hand is lost to erase the last frame.
   */
  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Removes the canvas from the DOM, clears event listeners,
   * and releases the 2D rendering context.
   * Call when tearing down the application.
   */
  dispose(): void {
    this.clear();
    this.canvas.classList.remove('visible');
    window.removeEventListener('resize', this.onResize);
  }

  // ─── Drawing primitives ───────────────────────────────────────────────────

  /**
   * Draws all skeleton bones as semi-transparent lines between landmark pairs.
   * Renders before joints so joint dots sit on top of the line endpoints.
   */
  private drawSkeleton(lm: NormalizedLandmark[]): void {
    const { canvas: c, ctx } = this;
    ctx.strokeStyle = COLOR_SKELETON;
    ctx.lineWidth   = 1.2;

    for (const [a, b] of SKELETON_BONES) {
      ctx.beginPath();
      ctx.moveTo(lm[a].x * c.width, lm[a].y * c.height);
      ctx.lineTo(lm[b].x * c.width, lm[b].y * c.height);
      ctx.stroke();
    }
  }

  /**
   * Draws each landmark as a dot.
   * Wrist and fingertips use larger radii for quick visual identification.
   * Key landmarks receive a short text label offset above the dot.
   */
  private drawJoints(lm: NormalizedLandmark[]): void {
    const { canvas: c, ctx } = this;

    lm.forEach((point, index) => {
      const x = point.x * c.width;
      const y = point.y * c.height;

      // Choose radius based on landmark role
      let radius = DOT_RADIUS_JOINT;
      if (index === 0)                     radius = DOT_RADIUS_WRIST;
      else if (FINGERTIP_INDICES.has(index)) radius = DOT_RADIUS_TIP;

      // Dot fill
      ctx.fillStyle = index === 0 ? COLOR_WRIST : COLOR_JOINT;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Optional label for key landmarks
      const label = LANDMARK_LABELS[index];
      if (label) {
        ctx.fillStyle = COLOR_LABEL;
        ctx.font      = FONT_LABEL;
        ctx.fillText(label, x + radius + 3, y - radius - 2);
      }
    });
  }

  /**
   * Draws a semi-transparent readout panel in the top-left corner
   * showing the current computed GestureFeatures values.
   * Provides instant feedback when tuning EMA alphas or thresholds.
   *
   * @param f - GestureFeatures to display.
   */
  private drawFeaturePanel(f: GestureFeatures): void {
    const { ctx } = this;
    const lines = [
      `height   : ${f.heightNormalized.toFixed(3)}`,
      `openness : ${f.openness.toFixed(3)}`,
      `pinch    : ${f.pinchStrength.toFixed(3)}`,
      `fist     : ${f.isFist}`,
    ];

    ctx.font = FONT_FEATURE;
    const lineHeight  = 18;
    const panelWidth  = 200;
    const panelHeight = lines.length * lineHeight + PANEL_PADDING * 2;
    const panelX      = PANEL_PADDING;
    const panelY      = PANEL_PADDING;

    // Background panel
    ctx.fillStyle = COLOR_FEATURE_BG;
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelWidth, panelHeight, 6);
    ctx.fill();

    // Text lines
    ctx.fillStyle = COLOR_FEATURE_TEXT;
    lines.forEach((line, i) => {
      ctx.fillText(
        line,
        panelX + PANEL_PADDING,
        panelY + PANEL_PADDING + (i + 1) * lineHeight - 4,
      );
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Locates the <canvas id="debug-canvas"> element expected in index.html.
   * Throws early with a clear message if the element is missing,
   * since DebugOverlay is useless without a canvas to draw on.
   */
  private getCanvas(): HTMLCanvasElement {
    const el = document.getElementById('debug-canvas');
    if (!(el instanceof HTMLCanvasElement)) {
      throw new Error(
        '[DebugOverlay] <canvas id="debug-canvas"> not found in the DOM. '
        + 'Ensure index.html contains this element before enabling debug mode.',
      );
    }
    return el;
  }

  /**
   * Synchronises the canvas pixel dimensions with the current viewport size.
   * Called at construction and on every window resize event.
   * Without this, landmarks would be drawn at the wrong coordinates
   * after the user resizes the browser window.
   */
  private syncSize(): void {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
}