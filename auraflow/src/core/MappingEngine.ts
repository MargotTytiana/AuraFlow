/**
 * MappingEngine.ts
 * Translates semantic gesture features into AudioEngine control calls
 * based on the active scene's mapping configuration.
 *
 * Responsibilities:
 *  - Reading the current scene mapping rules from AppState each frame
 *  - Routing each gesture axis to its configured audio parameter
 *  - Inverting or transforming values where the mapping demands it
 *  - Handling the hand-lost state with a graceful fade-out
 *  - Reacting to scene changes via AppState subscriptions
 *
 * This module contains all "which gesture controls what" business logic.
 * AudioEngine has no knowledge of gestures.
 * GestureAnalyzer has no knowledge of audio.
 * MappingEngine is the only module that knows about both.
 */

import type { GestureFeatures }         from '../types/gesture';
import type { SceneMapping, ScenePreset } from '../types/scene';
import type { AudioEngine }             from './AudioEngine';
import type { AppState }                from '../store/AppState';
import { clamp, lerp }                  from '../utils/math';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * How long (in seconds) the engine waits after the last detected frame
 * before triggering a full mute. Prevents a brief hand occlusion
 * from cutting audio unnecessarily.
 */
const HAND_LOST_MUTE_DELAY_MS = 600;

/**
 * Minimum pinch strength required to register a scene-switch event.
 * Prevents accidental triggers from a partial pinch.
 */
const PINCH_SCENE_SWITCH_THRESHOLD = 0.92;

/**
 * Filter frequency range driven by the horizontal mapping.
 * Must match the constants in AudioEngine to produce consistent behaviour.
 */
const FILTER_FREQ_MIN = 200;
const FILTER_FREQ_MAX = 8000;

// ─── MappingEngine ────────────────────────────────────────────────────────────

export class MappingEngine {
  /** Timer handle for the delayed mute after hand loss. */
  private handLostTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Tracks whether a pinch-scene-switch was already fired this gesture
   * so it does not repeat while the fingers stay pinched.
   */
  private pinchSwitchFired = false;

  /** Ordered list of scenes to cycle through on pinch-switch. */
  private sceneSequence: ScenePreset[] = [];

  /** Cleanup function returned by AppState.on('currentScene'). */
  private unsubscribeScene: (() => void) | null = null;

  /**
   * @param audio  - AudioEngine instance to drive.
   * @param state  - AppState instance to read scene config from.
   * @param scenes - Optional ordered scene list for pinch-switch cycling.
   *                 If omitted, pinch-switch has no effect.
   */
  constructor(
    private readonly audio:  AudioEngine,
    private readonly state:  AppState,
    scenes: ScenePreset[] = [],
  ) {
    this.sceneSequence = scenes;

    // Re-apply the new scene's audio defaults whenever the scene changes
    this.unsubscribeScene = this.state.on<ScenePreset>(
      'currentScene',
      (next) => this.onSceneChanged(next),
    );
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Main per-frame entry point. Called by App.ts with the latest
   * GestureFeatures from GestureAnalyzer.
   *
   * Clears any pending hand-lost timer, then routes each gesture axis
   * to its configured audio parameter according to the active scene.
   *
   * @param features - Smoothed gesture features for the current frame.
   */
  apply(features: GestureFeatures): void {
    this.clearHandLostTimer();

    // Fist overrides all other mappings — immediate mute
    if (features.isFist) {
      this.audio.mute();
      return;
    }

    this.audio.unmute();

    const { mapping } = this.state.currentScene;

    this.applyVertical(features, mapping);
    this.applyHorizontal(features, mapping);
    this.applyOpenness(features, mapping);
    this.applyPinch(features, mapping);
  }

  /**
   * Called by App.ts when VisionCapture fires its onHandLost callback.
   * Schedules a mute after a short delay to absorb brief occlusions.
   */
  onHandLost(): void {
    if (this.handLostTimer !== null) return; // already scheduled

    this.handLostTimer = setTimeout(() => {
      this.audio.mute();
      this.handLostTimer = null;
    }, HAND_LOST_MUTE_DELAY_MS);
  }

  /**
   * Releases subscriptions and cancels any pending timers.
   * Call when the application is torn down.
   */
  dispose(): void {
    this.clearHandLostTimer();
    this.unsubscribeScene?.();
  }

  // ─── Axis handlers ────────────────────────────────────────────────────────

  /**
   * Maps the vertical hand position (heightNormalized) to its
   * configured audio target.
   *
   * heightNormalized: 0 = top of frame, 1 = bottom.
   * All 'volume' mappings invert the value so raising the hand = louder,
   * matching the natural expectation of lifting to increase sound.
   */
  private applyVertical(f: GestureFeatures, m: SceneMapping): void {
    switch (m.vertical) {
      case 'volume':
        // Invert: hand raised (low y) → high gain
        this.audio.setMasterGain(clamp(1 - f.heightNormalized));
        break;

      case 'filterFreq':
        // Invert: hand raised → brighter (higher cutoff)
        this.audio.setFilterFrequency(clamp(1 - f.heightNormalized));
        break;

      case 'none':
        break;
    }
  }

  /**
   * Maps the horizontal hand position to its configured audio target.
   *
   * Horizontal position is derived from the wrist x-coordinate,
   * normalised to [0, 1] by VisionCapture (0 = left, 1 = right).
   * Note: camera image is mirrored, so physical left = high x value.
   */
  private applyHorizontal(f: GestureFeatures, m: SceneMapping): void {
    switch (m.horizontal) {
      case 'filterFreq':
        // Left hand position → darker tone, right → brighter
        // heightNormalized is reused here; a dedicated xNormalized
        // field should be added to GestureFeatures in a future iteration
        this.audio.setFilterFrequency(clamp(f.heightNormalized));
        break;

      case 'pan':
        // Reserved for stereo panning — requires AudioEngine.setPan()
        // which is not yet implemented. No-op for now.
        break;

      case 'mix':
        // Reserved for arbitrary source blend ratio.
        break;

      case 'none':
        break;
    }
  }

  /**
   * Maps hand openness to its configured audio target.
   * openness: 0 = closed / cupped, 1 = fully spread.
   */
  private applyOpenness(f: GestureFeatures, m: SceneMapping): void {
    switch (m.openness) {
      case 'noiseDensity':
        // Open hand = richer noise texture at higher gain
        this.audio.setNoiseGain(clamp(f.openness));
        break;

      case 'none':
        break;
    }
  }

  /**
   * Maps pinch strength to its configured audio target.
   * pinchStrength: 0 = fingers apart, 1 = fully pinched.
   */
  private applyPinch(f: GestureFeatures, m: SceneMapping): void {
    switch (m.pinch) {
      case 'rainMix': {
        // Pinch fades rain in; release fades stream in (if active)
        const rainGain   = clamp(f.pinchStrength);
        const streamGain = clamp(1 - f.pinchStrength);
        this.audio.setSampleGain('rain',   rainGain   * 0.6);
        this.audio.setSampleGain('stream', streamGain * 0.6);
        break;
      }

      case 'sceneSwitch':
        this.handlePinchSceneSwitch(f.pinchStrength);
        break;

      case 'none':
        break;
    }
  }

  // ─── Scene switch ─────────────────────────────────────────────────────────

  /**
   * Cycles to the next scene in sceneSequence when pinch crosses the
   * threshold. Uses a latch (pinchSwitchFired) so the switch fires
   * exactly once per pinch gesture rather than every frame above threshold.
   *
   * @param strength - Current pinch strength in [0, 1].
   */
  private handlePinchSceneSwitch(strength: number): void {
    if (strength >= PINCH_SCENE_SWITCH_THRESHOLD && !this.pinchSwitchFired) {
      this.pinchSwitchFired = true;
      this.cycleScene();
    } else if (strength < PINCH_SCENE_SWITCH_THRESHOLD) {
      // Reset latch once pinch is released so the next pinch can fire again
      this.pinchSwitchFired = false;
    }
  }

  /**
   * Advances to the next scene in the configured sequence.
   * Wraps around to the first scene after the last one.
   * No-op if sceneSequence is empty.
   */
  private cycleScene(): void {
    if (this.sceneSequence.length === 0) return;

    const currentIndex = this.sceneSequence.findIndex(
      (s) => s.id === this.state.currentScene.id,
    );
    const nextIndex = (currentIndex + 1) % this.sceneSequence.length;
    this.state.setScene(this.sceneSequence[nextIndex]);
  }

  // ─── Scene change reaction ────────────────────────────────────────────────

  /**
   * Called via AppState subscription whenever the active scene changes.
   * Resets audio sources that are no longer active in the new scene
   * and applies any scene-level defaults.
   *
   * @param next - The newly activated scene preset.
   */
  private onSceneChanged(next: ScenePreset): void {
    // Fade out any sample sources not used by the incoming scene
    const allSources = ['rain', 'stream'] as const;
    allSources.forEach((source) => {
      if (!next.audioSources.includes(source)) {
        this.audio.setSampleGain(source, 0);
      }
    });

    // Silence noise if the new scene does not use it
    if (!next.audioSources.includes('noise')) {
      this.audio.setNoiseGain(0);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /** Cancels the pending hand-lost mute timer if one exists. */
  private clearHandLostTimer(): void {
    if (this.handLostTimer !== null) {
      clearTimeout(this.handLostTimer);
      this.handLostTimer = null;
    }
  }
}