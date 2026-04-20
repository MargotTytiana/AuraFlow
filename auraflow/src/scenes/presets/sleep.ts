import type { ScenePreset } from '../ScenePreset';

export const sleepPreset: ScenePreset = {
  name: '睡前助眠',
  audioSources: ['noise', 'rain', 'stream'],
  mapping: {
    vertical: 'volume',
    horizontal: 'none',
    openness: 'none',
    pinch: 'none'
  }
};