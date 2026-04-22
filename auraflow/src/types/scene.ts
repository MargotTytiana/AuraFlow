/**
 * scene.ts
 * Shared type definitions for scene preset configuration.
 * Implemented by preset files, held by AppState, read by MappingEngine.
 */

/**
 * Audio source identifiers supported by AudioEngine.
 * - 'noise'  : generated white/pink noise via Web Audio API
 * - 'rain'   : looping rain sample from public/audio/rain.mp3
 * - 'stream' : looping stream sample from public/audio/stream.mp3
 */
export type AudioSource = 'noise' | 'rain' | 'stream';

/**
 * Mapping targets for the vertical hand position (heightNormalized).
 * - 'volume'    : controls master gain
 * - 'filterFreq': controls low-pass filter cutoff frequency
 * - 'none'      : vertical axis is ignored in this scene
 */
export type VerticalMapping = 'volume' | 'filterFreq' | 'none';

/**
 * Mapping targets for the horizontal hand position.
 * - 'pan' : controls stereo panning
 * - 'mix' : controls blend ratio between two audio sources
 * - 'none': horizontal axis is ignored in this scene
 */
export type HorizontalMapping = 'pan' | 'mix' | 'none';

/**
 * Mapping targets for hand openness.
 * - 'noiseDensity': controls noise bandwidth / gain
 * - 'none'        : openness is ignored in this scene
 */
export type OpennessMapping = 'noiseDensity' | 'none';

/**
 * Mapping targets for pinch strength.
 * - 'rainMix'     : cross-fades rain/stream sample volume
 * - 'sceneSwitch' : triggers a discrete scene transition when fully pinched
 * - 'none'        : pinch is ignored in this scene
 */
export type PinchMapping = 'rainMix' | 'sceneSwitch' | 'none';

/**
 * Declares which gesture axis controls which audio parameter.
 * Each axis maps to exactly one target — or 'none' to disable it.
 */
export interface SceneMapping {
  vertical:   VerticalMapping;
  horizontal: HorizontalMapping;
  openness:   OpennessMapping;
  pinch:      PinchMapping;
}

/**
 * A complete scene preset configuration.
 * Defines the audio sources to activate and how each gesture
 * axis is translated into audio parameters.
 */
export interface ScenePreset {
  /** Unique identifier used for state management and analytics. */
  id: string;

  /** Human-readable display name shown in the UI. */
  name: string;

  /**
   * List of audio sources to activate when this scene is loaded.
   * AudioEngine will start only the sources listed here.
   */
  audioSources: AudioSource[];

  /** Gesture-to-audio mapping rules for this scene. */
  mapping: SceneMapping;
}