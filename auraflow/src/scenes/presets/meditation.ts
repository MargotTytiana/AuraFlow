/**
 * meditation.ts
 * Scene preset configuration for the deep meditation mode.
 *
 * Audio sources: white noise + rain sample
 *
 * Gesture mapping:
 *  - Vertical position → master volume
 *    Raise hand to increase volume, lower to decrease.
 *    Encourages slow, deliberate vertical movements matching
 *    the pace of deep breathing.
 *
 *  - Openness → noise density
 *    Spread fingers wide to open up the noise texture,
 *    cup the hand to narrow it. Gives a tactile sense of
 *    "holding" the soundscape.
 *
 *  - Pinch → rain mix
 *    Bring index finger and thumb together to fade rain in,
 *    release to let white noise dominate.
 *
 *  - Horizontal axis → unused
 *    Kept intentionally inactive to reduce cognitive load
 *    during meditation. Fewer axes = less to think about.
 *
 * This preset is the application default. It is passed to AppState
 * at construction time in App.ts.
 */

import type { ScenePreset } from '../../types/scene';

export const meditationPreset: ScenePreset = {
  id:   'meditation',
  name: '深度冥想',

  /**
   * Both noise and rain are activated so AudioEngine pre-warms
   * their source nodes when this scene is loaded.
   * Gain for each source starts at 0 and is driven by gesture mapping.
   */
  audioSources: ['noise', 'rain'],

  mapping: {
    /**
     * Raising the hand increases master volume.
     * MappingEngine inverts heightNormalized (0 = top = loud)
     * before passing it to AudioEngine.setMasterGain().
     */
    vertical: 'volume',

    /**
     * Horizontal axis is intentionally disabled for this scene.
     * Lateral hand movement has no effect, keeping the interaction
     * focused on the vertical breathing gesture.
     */
    horizontal: 'none',

    /**
     * Hand openness controls noise bandwidth / gain.
     * A fully open hand produces a rich, wide noise texture.
     * A cupped hand narrows it to a softer, more focused tone.
     */
    openness: 'noiseDensity',

    /**
     * Pinch controls the cross-fade between white noise and rain.
     * Full pinch = rain at maximum mix level.
     * Released = noise dominates.
     */
    pinch: 'rainMix',
  },
};