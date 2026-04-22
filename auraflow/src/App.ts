/**
 * App.ts
 * Application root — assembles all modules and manages the lifecycle.
 *
 * Responsibilities:
 *  - Instantiating every module in dependency order
 *  - Injecting shared dependencies (AppState, AudioEngine) into consumers
 *  - Wiring the data-flow callbacks between perception, logic, and audio layers
 *  - Resuming and suspending AudioContext on page visibility changes
 *  - Cleanly disposing all modules on page unload
 *  - Showing the first-use hint via StatusIndicator
 *
 * Architectural rule:
 *  App.ts is the ONLY file permitted to import from every layer simultaneously.
 *  No other module may import from a sibling layer — all cross-layer
 *  communication is routed through the callbacks and injected dependencies
 *  established here.
 *
 * Data flow:
 *
 *  VisionCapture
 *      │ onLandmarks(NormalizedLandmark[])
 *      ▼
 *  GestureAnalyzer.extract()
 *      │ GestureFeatures
 *      ▼
 *  MappingEngine.apply()
 *      │ setNoiseGain / setFilterFrequency / setSampleGain ...
 *      ▼
 *  AudioEngine
 *      │
 *      ▼
 *  Web Audio API destination (speakers)
 */

import { VisionCapture }   from './core/VisionCapture';
import { GestureAnalyzer } from './core/GestureAnalyzer';
import { AudioEngine }     from './core/AudioEngine';
import { MappingEngine }   from './core/MappingEngine';
import { AppState }        from './store/AppState';
import { StatusIndicator } from './ui/StatusIndicator';
import { DebugOverlay }    from './ui/DebugOverlay';
import { meditationPreset } from './scenes/presets/meditation';
import { focusPreset }      from './scenes/presets/focus';
import { sleepPreset }      from './scenes/presets/sleep';
import type { NormalizedLandmark } from '@mediapipe/hands';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Ordered scene sequence used by MappingEngine for pinch-switch cycling.
 * The first entry is also the default scene loaded at startup.
 */
const SCENE_SEQUENCE = [meditationPreset, focusPreset, sleepPreset] as const;

/**
 * First-use hint message shown by StatusIndicator on startup.
 * Disappears automatically after the default hint duration (3 s).
 */
const FIRST_USE_HINT = '将手放在摄像头前开始';

// ─── App ──────────────────────────────────────────────────────────────────────

export class App {
  // All module references are stored so dispose() can clean them up cleanly
  private state!:     AppState;
  private audio!:     AudioEngine;
  private analyzer!:  GestureAnalyzer;
  private mapping!:   MappingEngine;
  private vision!:    VisionCapture;
  private indicator!: StatusIndicator;
  private debug!:     DebugOverlay | null;

  /** Bound event handler references kept for removeEventListener parity. */
  private readonly onVisibilityChange: () => void;
  private readonly onBeforeUnload:     () => void;

  constructor() {
    this.onVisibilityChange = () => this.handleVisibilityChange();
    this.onBeforeUnload     = () => this.dispose();
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  /**
   * Initialises all modules in dependency order and starts the
   * perception loop. Must be called inside a user gesture handler
   * (e.g. a button click) so that:
   *  1. The browser permits getUserMedia camera access.
   *  2. AudioContext.resume() is allowed without a separate gesture.
   *
   * Throws if any critical initialisation step fails, allowing
   * main.ts to catch and display a user-facing error.
   */
  async init(): Promise<void> {
    // ── 1. Shared state ───────────────────────────────────────────────────
    // AppState is constructed first — every other module may receive it
    // as a constructor argument, so it must exist before any of them.
    this.state = new AppState(SCENE_SEQUENCE[0]);

    // ── 2. Audio layer ────────────────────────────────────────────────────
    // AudioEngine creates the AudioContext here, inside the user gesture,
    // satisfying the browser's autoplay policy.
    this.audio = new AudioEngine();
    await this.audio.resume();

    // ── 3. Perception layer ───────────────────────────────────────────────
    // GestureAnalyzer is stateless except for its EMA smoothers —
    // no dependencies beyond utility functions.
    this.analyzer = new GestureAnalyzer();

    // ── 4. Logic layer ────────────────────────────────────────────────────
    // MappingEngine needs both AudioEngine and AppState.
    // The full scene sequence is passed so it can cycle on pinch-switch.
    this.mapping = new MappingEngine(
      this.audio,
      this.state,
      [...SCENE_SEQUENCE],
    );

    // ── 5. UI layer ───────────────────────────────────────────────────────
    // StatusIndicator subscribes to AppState.isMuted automatically
    // when AppState is injected.
    this.indicator = new StatusIndicator(this.state);

    // DebugOverlay is only instantiated when ?debug=true is present.
    // In production builds this branch is never reached.
    this.debug = this.state.debugMode ? new DebugOverlay() : null;

    // ── 6. Perception loop ────────────────────────────────────────────────
    // VisionCapture is started last — its callbacks reference all the
    // modules above, which must be fully constructed before firing.
    this.vision = new VisionCapture(
      (landmarks) => this.onLandmarks(landmarks),
      ()          => this.onHandLost(),
      {
        // Scale minDetectionConfidence by the AppState sensitivity value
        minDetectionConfidence: 0.8 * this.state.sensitivity,
      },
    );

    await this.vision.start();

    // ── 7. System event listeners ─────────────────────────────────────────
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('beforeunload',       this.onBeforeUnload);

    // ── 8. First-use hint ─────────────────────────────────────────────────
    this.indicator.showHint(FIRST_USE_HINT);
  }

  /**
   * Stops all modules and removes all event listeners.
   * Safe to call multiple times — subsequent calls are no-ops.
   * Automatically called on page unload via beforeunload listener.
   */
  dispose(): void {
    this.vision?.stop();
    this.mapping?.dispose();
    this.indicator?.dispose();
    this.debug?.dispose();
    this.audio?.suspend();

    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('beforeunload',       this.onBeforeUnload);
  }

  // ─── Per-frame callbacks ──────────────────────────────────────────────────

  /**
   * Called every frame in which VisionCapture detects at least one hand.
   * Runs the full perception → logic pipeline for the current frame.
   *
   * @param landmarks - Raw 21-point landmark array from MediaPipe Hands.
   */
  private onLandmarks(landmarks: NormalizedLandmark[]): void {
    // Extract semantic features from raw coordinates
    const features = this.analyzer.extract(landmarks);

    // Route features to audio parameters via the scene's mapping rules
    this.mapping.apply(features);

    // Update the status indicator dot to the active state
    this.indicator.setActive(true);

    // Draw debug visualisation if overlay is enabled
    // Pass features so the readout panel shows live computed values
    this.debug?.draw(landmarks, features);
  }

  /**
   * Called every frame in which no hand is present.
   * Delegates to MappingEngine (which schedules a delayed mute)
   * and updates the indicator and debug overlay accordingly.
   */
  private onHandLost(): void {
    this.mapping.onHandLost();
    this.analyzer.reset();
    this.indicator.setActive(false);
    this.debug?.clear();
  }

  // ─── System event handlers ────────────────────────────────────────────────

  /**
   * Suspends AudioContext when the page is hidden (tab switch, lock screen)
   * and resumes it when the page becomes visible again.
   *
   * Suspension releases the system audio hardware, which is important
   * on mobile where audio resources are limited. It also stops MediaPipe
   * inference from running in the background, saving battery.
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.vision.stop();
      this.audio.suspend();
    } else {
      // Re-initialise vision capture and resume audio when page is visible
      this.audio.resume().then(() => this.vision.start());
    }
  }
}