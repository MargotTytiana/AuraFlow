/**
 * VisionCapture.ts
 * Handles all low-level camera and MediaPipe Hands operations.
 *
 * Responsibilities:
 *  - Requesting camera access via getUserMedia
 *  - Initialising and configuring the MediaPipe Hands model
 *  - Driving per-frame inference inside a requestAnimationFrame loop
 *  - Forwarding raw landmarks upward via callbacks
 *
 * This module is the perception boundary — no gesture semantics live here.
 * Upper layers receive only NormalizedLandmark arrays and react accordingly.
 */

import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import type { NormalizedLandmark } from '@mediapipe/hands';

// ─── Callback types ───────────────────────────────────────────────────────────

/**
 * Called every frame in which at least one hand is detected.
 * Receives the 21-point landmark array for the primary hand.
 */
type LandmarkCallback = (landmarks: NormalizedLandmark[]) => void;

/**
 * Called when no hand is present in the current frame.
 * Used to trigger fade-out or pause behaviour in upper layers.
 */
type HandLostCallback = () => void;

// ─── Configuration ────────────────────────────────────────────────────────────

interface VisionCaptureOptions {
  /**
   * MediaPipe model complexity.
   * 0 = fastest / least accurate, 1 = balanced (default), 2 = most accurate.
   */
  modelComplexity?: 0 | 1 | 2;

  /**
   * Minimum confidence required to consider a detection valid.
   * Higher values reduce false positives in complex backgrounds.
   * Default: 0.8
   */
  minDetectionConfidence?: number;

  /**
   * Minimum confidence to continue tracking an already-detected hand.
   * Can be lower than detection confidence for smoother tracking.
   * Default: 0.5
   */
  minTrackingConfidence?: number;

  /** Camera capture width in pixels. Default: 640 */
  width?: number;

  /** Camera capture height in pixels. Default: 480 */
  height?: number;
}

const DEFAULT_OPTIONS: Required<VisionCaptureOptions> = {
  modelComplexity:       1,
  minDetectionConfidence: 0.8,
  minTrackingConfidence:  0.5,
  width:  640,
  height: 480,
};

// ─── VisionCapture ────────────────────────────────────────────────────────────

export class VisionCapture {
  private hands!: Hands;
  private camera!: Camera;
  private options: Required<VisionCaptureOptions>;
  private running = false;

  /**
   * @param onLandmarks - Fired each frame a hand is detected.
   * @param onHandLost  - Fired each frame no hand is present.
   * @param options     - Optional model and capture configuration.
   */
  constructor(
    private readonly onLandmarks: LandmarkCallback,
    private readonly onHandLost:  HandLostCallback,
    options: VisionCaptureOptions = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Initialises MediaPipe Hands, requests camera access, and starts
   * the per-frame inference loop.
   *
   * Must be called after a user gesture so that the browser permits
   * both camera access and AudioContext resumption in the same handler.
   */
  async start(): Promise<void> {
    if (this.running) return;

    const video = this.getVideoElement();

    this.hands = this.buildHandsModel();
    this.hands.onResults((results: Results) => this.handleResults(results));

    this.camera = new Camera(video, {
      onFrame: async () => {
        await this.hands.send({ image: video });
      },
      width:  this.options.width,
      height: this.options.height,
    });

    await this.camera.start();
    this.running = true;
  }

  /**
   * Stops the camera stream and releases the MediaPipe Hands model.
   * Safe to call even if start() was never invoked.
   */
  stop(): void {
    if (!this.running) return;
    this.camera?.stop();
    this.hands?.close();
    this.running = false;
  }

  /** Whether the capture loop is currently active. */
  get isRunning(): boolean {
    return this.running;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Locates the <video> element expected to be present in index.html.
   * Throws early with a clear message if the element is missing.
   */
  private getVideoElement(): HTMLVideoElement {
    const el = document.getElementById('input_video');
    if (!(el instanceof HTMLVideoElement)) {
      throw new Error(
        '[VisionCapture] <video id="input_video"> not found in the DOM. '
        + 'Ensure index.html contains this element before calling start().',
      );
    }
    return el;
  }

  /**
   * Builds and configures the MediaPipe Hands instance.
   * Model files are loaded from the jsDelivr CDN to avoid bundling
   * large WASM/binary assets with the application.
   */
  private buildHandsModel(): Hands {
    const hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    hands.setOptions({
      maxNumHands:            1,
      modelComplexity:        this.options.modelComplexity,
      minDetectionConfidence: this.options.minDetectionConfidence,
      minTrackingConfidence:  this.options.minTrackingConfidence,
    });

    return hands;
  }

  /**
   * Processes a single inference result from MediaPipe.
   * Forwards landmarks to the consumer callback, or signals hand loss
   * when no landmarks are present in the frame.
   */
  private handleResults(results: Results): void {
    if (results.multiHandLandmarks?.length) {
      // Always use the first detected hand (maxNumHands is set to 1)
      this.onLandmarks(results.multiHandLandmarks[0]);
    } else {
      this.onHandLost();
    }
  }
}