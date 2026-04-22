/**
 * sleep.ts
 * Scene preset configuration for the sleep assistance mode.
 *
 * Audio sources: rain sample + stream sample
 *
 * Gesture mapping:
 *  - Vertical position → master volume
 *    Gently lower the hand to reduce volume as the body relaxes
 *    and drifts toward sleep. The downward motion mirrors the
 *    natural settling of the body into rest.
 *
 *  - Pinch → rain / stream cross-fade
 *    Pinch to bring rain forward in the mix, release to let
 *    the stream take over. Both sources are natural and non-stimulating,
 *    so the blend is a matter of personal preference rather than
 *    cognitive function.
 *
 *  - Horizontal axis → unused
 *    No tonal control is offered. Filter frequency stays fixed
 *    at a warm, low-mid setting set by AudioEngine defaults,
 *    avoiding any brightness that might delay sleep onset.
 *
 *  - Openness → unused
 *    Noise density is irrelevant as white noise is not active.
 *    Keeping the hand softly relaxed — rather than consciously
 *    spread — is more conducive to physical relaxation.
 *
 * Design rationale:
 *  Sleep mode uses only natural organic samples and avoids
 *  synthesised noise entirely. The interaction surface is reduced
 *  to a single continuous axis (height → volume) and one optional
 *  blend gesture (pinch → rain mix), so the user can close their
 *  eyes and interact by feel alone without needing to think.
 *  The fewer the axes, the sooner the mind can disengage.
 */

import type { ScenePreset } from '../../types/scene';

export const sleepPreset: ScenePreset = {
  id:   'sleep',
  name: '助眠模式',

  /**
   * Rain and stream samples only — no synthesised noise.
   * Both are organic, spectrally dense, and non-rhythmic,
   * which research on pink-noise sleep induction suggests
   * is more effective than white noise for prolonged relaxation.
   * AudioEngine pre-warms both source nodes when this scene loads.
   */
  audioSources: ['rain', 'stream'],

  mapping: {
    /**
     * Vertical position maps to master volume.
     * As the user relaxes and their arm naturally lowers,
     * the soundscape fades gently — a passive fade-out
     * that requires no deliberate action to trigger.
     * MappingEngine inverts heightNormalized before calling
     * AudioEngine.setMasterGain() so that a raised hand = loud
     * and a lowered hand = quiet.
     */
    vertical: 'volume',

    /**
     * Horizontal axis is disabled.
     * Filter frequency is fixed at the AudioEngine default (2000 Hz),
     * which produces a warm, non-fatiguing tone suitable for
     * extended listening during sleep.
     */
    horizontal: 'none',

    /**
     * Openness is unused because white noise is not active in
     * this scene. Asking the user to consciously spread their
     * fingers would introduce unnecessary physical tension
     * counterproductive to sleep onset.
     */
    openness: 'none',

    /**
     * Pinch cross-fades between rain and stream.
     * Full pinch = rain at maximum, stream faded back.
     * Released = stream rises, rain recedes.
     * Both endpoints are equally restful, so this is purely
     * a preference control rather than a functional one.
     * MappingEngine routes pinchStrength to
     * AudioEngine.setSampleGain('rain') and its inverse
     * to AudioEngine.setSampleGain('stream').
     */
    pinch: 'rainMix',
  },
};