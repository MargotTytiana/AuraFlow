/**
 * AudioEngine.ts
 * Owns and operates the entire Web Audio API node graph.
 *
 * Responsibilities:
 *  - Building and connecting all audio nodes at construction time
 *  - Generating white noise procedurally via AudioBuffer
 *  - Loading and looping ambient audio samples (rain, stream)
 *  - Exposing semantic control methods for MappingEngine to call
 *  - Applying parameter changes with short ramps to avoid clicks
 *
 * This module has no knowledge of gestures, scenes, or UI.
 * It is a pure audio actuator: control values in, sound out.
 *
 * Node graph:
 *
 *   [NoiseSource] ──┐
 *                   ├── [BiquadFilter (lowpass)] ──┐
 *   [RainGain] ─────┘                              ├── [MasterGain] ── [Destination]
 *   [StreamGain] ──────────────────────────────────┘
 */

import { clamp, logLerp } from '../utils/math';

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Duration of the looping white noise buffer in seconds.
 * Longer buffers reduce the audibility of the loop boundary
 * but consume more memory. 3 seconds is imperceptible at normal listening.
 */
const NOISE_BUFFER_DURATION_S = 3;

/**
 * Duration of audio parameter ramps in seconds.
 * Short enough to feel responsive, long enough to avoid audible clicks.
 */
const RAMP_TIME_S = 0.05;

/** Default master gain on unmute. Keeps headphone listeners safe. */
const DEFAULT_MASTER_GAIN = 0.6;

/** Filter frequency range in Hz for the low-pass filter mapping. */
const FILTER_FREQ_MIN = 200;
const FILTER_FREQ_MAX = 8000;

// ─── Sample descriptor ────────────────────────────────────────────────────────

interface SampleTrack {
  /** Public URL path, resolved relative to the Vite dev server root. */
  url:    string;
  source: AudioBufferSourceNode | null;
  gain:   GainNode;
  buffer: AudioBuffer | null;
}

// ─── AudioEngine ──────────────────────────────────────────────────────────────

export class AudioEngine {
  readonly ctx: AudioContext;

  // Master output chain
  private readonly masterGain: GainNode;
  private readonly filter:     BiquadFilterNode;

  // Noise source (procedurally generated, created lazily on first use)
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGainNode: GainNode;

  // Ambient sample tracks
  private readonly tracks: Record<'rain' | 'stream', SampleTrack>;

  // Mute state is tracked separately so unmute can restore the correct level
  private muted       = false;
  private targetGain  = DEFAULT_MASTER_GAIN;

  constructor() {
    this.ctx = new AudioContext();

    // ── Master chain ──────────────────────────────────────────────────────────
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0; // start silent; unmute explicitly

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type            = 'lowpass';
    this.filter.frequency.value = 2000;
    this.filter.Q.value         = 0.8;

    // ── Noise gain node ───────────────────────────────────────────────────────
    this.noiseGainNode = this.ctx.createGain();
    this.noiseGainNode.gain.value = 0;

    // ── Sample tracks ─────────────────────────────────────────────────────────
    this.tracks = {
      rain:   this.buildTrack('/audio/rain.mp3'),
      stream: this.buildTrack('/audio/stream.mp3'),
    };

    // ── Connect node graph ────────────────────────────────────────────────────
    //   noiseGainNode → filter → masterGain → destination
    //   rainGain      ──────────────────────↗
    //   streamGain    ──────────────────────↗
    this.noiseGainNode.connect(this.filter);
    this.filter.connect(this.masterGain);
    this.tracks.rain.gain.connect(this.masterGain);
    this.tracks.stream.gain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Begin loading samples in the background; audio works before they finish
    this.loadAllSamples();
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Resumes the AudioContext after a user gesture.
   * Browsers suspend AudioContext by default; this must be called inside
   * a click/touch handler before any sound will be produced.
   */
  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Suspends the AudioContext to free system audio resources.
   * Call when the app moves to the background (Page Visibility API).
   */
  async suspend(): Promise<void> {
    await this.ctx.suspend();
  }

  // ─── Noise controls ──────────────────────────────────────────────────────────

  /**
   * Sets the white noise output level.
   * Starts the noise source node on first call (lazy initialisation).
   *
   * @param value - Normalised gain in [0, 1].
   */
  setNoiseGain(value: number): void {
    this.ensureNoiseRunning();
    const gain = clamp(value) * 0.7; // headroom cap
    this.noiseGainNode.gain.linearRampToValueAtTime(
      gain,
      this.ctx.currentTime + RAMP_TIME_S,
    );
  }

  /**
   * Sets the low-pass filter cutoff frequency.
   * Uses logarithmic scaling to match human pitch perception.
   *
   * @param normalised - Value in [0, 1], mapped to [FILTER_FREQ_MIN, FILTER_FREQ_MAX].
   */
  setFilterFrequency(normalised: number): void {
    const freq = logLerp(clamp(normalised), FILTER_FREQ_MIN, FILTER_FREQ_MAX);
    this.filter.frequency.linearRampToValueAtTime(
      freq,
      this.ctx.currentTime + RAMP_TIME_S,
    );
  }

  // ─── Sample controls ─────────────────────────────────────────────────────────

  /**
   * Sets the gain for a named ambient sample track.
   * Starts the sample looping on first call if the buffer is loaded.
   *
   * @param name  - Track identifier ('rain' | 'stream').
   * @param value - Normalised gain in [0, 1].
   */
  setSampleGain(name: 'rain' | 'stream', value: number): void {
    const track = this.tracks[name];
    if (!track.buffer) return; // buffer not yet loaded, silently skip

    this.ensureSampleRunning(track);

    track.gain.gain.linearRampToValueAtTime(
      clamp(value) * 0.6,
      this.ctx.currentTime + RAMP_TIME_S,
    );
  }

  // ─── Master volume ────────────────────────────────────────────────────────────

  /**
   * Fades master gain to zero over a short ramp.
   * Stores the current target so unmute can restore it exactly.
   */
  mute(): void {
    if (this.muted) return;
    this.muted = true;
    this.masterGain.gain.linearRampToValueAtTime(
      0,
      this.ctx.currentTime + RAMP_TIME_S * 2,
    );
  }

  /**
   * Restores master gain to the level it had before mute() was called.
   */
  unmute(): void {
    if (!this.muted) return;
    this.muted = false;
    this.masterGain.gain.linearRampToValueAtTime(
      this.targetGain,
      this.ctx.currentTime + RAMP_TIME_S * 2,
    );
  }

  /**
   * Sets the master output level independently of mute state.
   *
   * @param value - Normalised gain in [0, 1].
   */
  setMasterGain(value: number): void {
    this.targetGain = clamp(value) * DEFAULT_MASTER_GAIN;
    if (!this.muted) {
      this.masterGain.gain.linearRampToValueAtTime(
        this.targetGain,
        this.ctx.currentTime + RAMP_TIME_S,
      );
    }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Builds a SampleTrack descriptor with its own GainNode.
   * The buffer and source are populated later by loadAllSamples().
   */
  private buildTrack(url: string): SampleTrack {
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    return { url, source: null, gain, buffer: null };
  }

  /**
   * Fetches and decodes all sample buffers concurrently.
   * Failures are non-fatal: the track simply remains silent.
   */
  private async loadAllSamples(): Promise<void> {
    await Promise.allSettled(
      Object.values(this.tracks).map((track) => this.loadSample(track)),
    );
  }

  /**
   * Fetches, decodes, and stores a single sample's AudioBuffer.
   */
  private async loadSample(track: SampleTrack): Promise<void> {
    try {
      const response = await fetch(track.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.arrayBuffer();
      track.buffer = await this.ctx.decodeAudioData(raw);
    } catch (err) {
      console.warn(`[AudioEngine] Failed to load sample "${track.url}":`, err);
    }
  }

  /**
   * Generates a white noise AudioBuffer of the configured duration.
   * Each channel sample is independently randomised in [-1, 1].
   */
  private buildNoiseBuffer(): AudioBuffer {
    const sampleRate = this.ctx.sampleRate;
    const length     = sampleRate * NOISE_BUFFER_DURATION_S;
    const buffer     = this.ctx.createBuffer(1, length, sampleRate);
    const channel    = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      channel[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Lazily creates and starts the looping noise source.
   * Subsequent calls are no-ops once the source is running.
   */
  private ensureNoiseRunning(): void {
    if (this.noiseSource) return;
    this.noiseSource        = this.ctx.createBufferSource();
    this.noiseSource.buffer = this.buildNoiseBuffer();
    this.noiseSource.loop   = true;
    this.noiseSource.connect(this.noiseGainNode);
    this.noiseSource.start();
  }

  /**
   * Lazily creates and starts a looping sample source for the given track.
   * Subsequent calls are no-ops once the source is running.
   */
  private ensureSampleRunning(track: SampleTrack): void {
    if (track.source || !track.buffer) return;
    track.source        = this.ctx.createBufferSource();
    track.source.buffer = track.buffer;
    track.source.loop   = true;
    track.source.connect(track.gain);
    track.source.start();
  }
}