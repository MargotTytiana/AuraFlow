import type { ScenePreset } from '../ScenePreset';

export const meditationPreset: ScenePreset = {
  name: '深度冥想',
  audioSources: ['noise', 'rain'],
  mapping: {
    vertical: 'volume',
    horizontal: 'none',
    openness: 'noiseDensity',
    pinch: 'sceneSwitch'
  }
};