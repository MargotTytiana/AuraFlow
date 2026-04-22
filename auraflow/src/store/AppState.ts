/**
 * AppState.ts
 * Single source of truth for all shared application state.
 *
 * Responsibilities:
 *  - Holding the currently active scene preset
 *  - Tracking mute, debug, and sensitivity flags
 *  - Providing a minimal subscription mechanism so UI and
 *    other modules can react to state changes without polling
 *
 * A single AppState instance is created by App.ts at startup
 * and injected into MappingEngine, UI modules, and any other
 * consumer that needs cross-cutting state.
 *
 * This module has no knowledge of audio, gestures, or rendering.
 * It is a plain data container with change notification.
 */

import type { ScenePreset } from '../types/scene';

// ─── Change event types ───────────────────────────────────────────────────────

/** Keys of AppState properties that support change subscriptions. */
export type StateKey = 'currentScene' | 'isMuted' | 'sensitivity' | 'debugMode';

/** Callback signature for state change subscribers. */
export type StateChangeCallback<T> = (next: T, prev: T) => void;

// ─── AppState ─────────────────────────────────────────────────────────────────

export class AppState {
  // ─── State fields ──────────────────────────────────────────────────────────

  /** The currently active scene preset, read each frame by MappingEngine. */
  private _currentScene: ScenePreset;

  /**
   * Whether audio output is currently muted.
   * MappingEngine checks this before applying gesture features.
   */
  private _isMuted = false;

  /**
   * Gesture detection sensitivity multiplier in [0.5, 1.5].
   * Applied to minDetectionConfidence in VisionCapture.
   * Higher = fewer false positives, harder to trigger in complex backgrounds.
   * Lower  = more responsive, may misfire on cluttered backgrounds.
   * Default: 1.0 (maps to minDetectionConfidence: 0.8 in VisionCapture).
   */
  private _sensitivity = 1.0;

  /**
   * Whether debug overlay is active.
   * Reads the ?debug query parameter once at construction — the overlay
   * is toggled for the entire session and cannot change at runtime.
   */
  private _debugMode: boolean;

  // ─── Subscriber registry ──────────────────────────────────────────────────

  /**
   * Map of state key → set of subscriber callbacks.
   * Using a Map of Sets allows multiple subscribers per key
   * and O(1) unsubscription.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private subscribers = new Map<StateKey, Set<StateChangeCallback<any>>>();

  // ─── Constructor ──────────────────────────────────────────────────────────

  /**
   * @param defaultScene - The scene preset to activate at startup.
   *                       Typically meditationPreset, passed from App.ts.
   */
  constructor(defaultScene: ScenePreset) {
    this._currentScene = defaultScene;
    this._debugMode    = new URLSearchParams(location.search).has('debug');
  }

  // ─── Accessors ────────────────────────────────────────────────────────────

  get currentScene(): ScenePreset { return this._currentScene; }
  get isMuted():      boolean     { return this._isMuted;      }
  get sensitivity():  number      { return this._sensitivity;  }
  get debugMode():    boolean     { return this._debugMode;    }

  // ─── Mutators ─────────────────────────────────────────────────────────────

  /**
   * Switches the active scene preset.
   * Notifies all 'currentScene' subscribers after the change.
   *
   * @param preset - The new scene preset to activate.
   */
  setScene(preset: ScenePreset): void {
    if (preset.id === this._currentScene.id) return; // no-op if same scene
    const prev = this._currentScene;
    this._currentScene = preset;
    this.notify('currentScene', preset, prev);
  }

  /**
   * Sets the mute flag and notifies subscribers.
   * Does nothing if the value is unchanged.
   *
   * @param muted - True to mute, false to unmute.
   */
  setMuted(muted: boolean): void {
    if (muted === this._isMuted) return;
    const prev = this._isMuted;
    this._isMuted = muted;
    this.notify('isMuted', muted, prev);
  }

  /** Convenience toggle — flips isMuted and notifies. */
  toggleMute(): void {
    this.setMuted(!this._isMuted);
  }

  /**
   * Updates the gesture detection sensitivity.
   * Value is clamped to [0.5, 1.5] to stay within safe model confidence bounds.
   *
   * @param value - New sensitivity multiplier.
   */
  setSensitivity(value: number): void {
    const clamped = Math.max(0.5, Math.min(1.5, value));
    if (clamped === this._sensitivity) return;
    const prev = this._sensitivity;
    this._sensitivity = clamped;
    this.notify('sensitivity', clamped, prev);
  }

  // ─── Subscription API ─────────────────────────────────────────────────────

  /**
   * Subscribes to changes for a specific state key.
   * The callback receives the next and previous values after each change.
   *
   * @param key      - The state property to observe.
   * @param callback - Function called on each change.
   * @returns        An unsubscribe function — call it to remove the listener.
   *
   * @example
   * const off = state.on('currentScene', (next) => {
   *   audio.loadScene(next);
   * });
   * // later:
   * off(); // removes the listener
   */
  on<T>(key: StateKey, callback: StateChangeCallback<T>): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    // Return an unsubscribe function for clean teardown
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Fires all callbacks registered for a given state key.
   * Called internally by every mutator after a confirmed state change.
   */
  private notify<T>(key: StateKey, next: T, prev: T): void {
    this.subscribers.get(key)?.forEach((cb) => cb(next, prev));
  }
}