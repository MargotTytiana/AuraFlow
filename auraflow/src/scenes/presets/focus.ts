import type { ScenePreset } from '../ScenePreset';

export const focusPreset: ScenePreset = {
  name: '专注心流',
  audioSources: ['noise'],
  mapping: {
    vertical: 'none',
    horizontal: 'filterFreq',
    openness: 'none',
    pinch: 'none'
  }
};