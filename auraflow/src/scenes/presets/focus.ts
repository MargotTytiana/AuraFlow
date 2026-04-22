/**
 * focus.ts
 * Scene preset configuration for the deep focus / flow state mode.
 *
 * Audio sources: white noise only
 *
 * Gesture mapping:
 *  - Horizontal position → filter cutoff frequency
 *    Move hand left for a darker, bass-heavy noise texture (low cutoff).
 *    Move hand right for a brighter, fuller noise texture (high cutoff).
 *    Lets the user dial in a tone that suits their cognitive state
 *    without consciously thinking about volume.
 *
 *  - Vertical axis → unused
 *    Volume is intentionally fixed in this scene. Constant loudness
 *    reduces the temptation to keep adjusting and helps maintain flow.
 *
 *  - Openness → unused
 *    Kept inactive to minimise the number of axes the user must
 *    manage while trying to concentrate.
 *
 *  - Pinch → unused
 *    No scene switching or sample mixing in focus mode.
 *    A single uninterrupted noise texture is preferred.
 *
 * Design rationale:
 *  Focus mode prioritises tonal control over volume control.
 *  Research on noise-assisted cognition suggests that a consistent,
 *  moderate-frequency masking noise improves concentration.
 *  The horizontal axis maps naturally to a left-right "tuning" metaphor
 *  familiar from analogue radio, requiring minimal conscious effort.
 */

import type { ScenePreset } from '../../types/scene';

export const focusPreset: ScenePreset = {
  id:   'focus',
  name: '专注心流',

  /**
   * White noise only — no ambient samples.
   * A single spectrally controllable source is sufficient for
   * cognitive masking and avoids distraction from layered textures.
   */
  audioSources: ['noise'],

  mapping: {
    /**
     * Vertical axis is disabled in this scene.
     * Master volume is held at a fixed comfortable level by AudioEngine.
     * Removing volume control prevents unconscious fidgeting
     * and keeps the user's hand in a stable, relaxed position.
     */
    vertical: 'none',

    /**
     * Horizontal hand position sweeps the low-pass filter cutoff
     * from FILTER_FREQ_MIN (200 Hz, very dark) to FILTER_FREQ_MAX (8000 Hz, bright).
     * MappingEngine passes the normalised x-coordinate directly to
     * AudioEngine.setFilterFrequency().
     */
    horizontal: 'filterFreq',

    /**
     * Openness is unused in focus mode.
     * Noise density remains constant so the texture stays predictable
     * and non-distracting during deep work sessions.
     */
    openness: 'none',

    /**
     * Pinch is unused — no sample mixing or scene transitions
     * are triggered in this preset.
     */
    pinch: 'none',
  },
};