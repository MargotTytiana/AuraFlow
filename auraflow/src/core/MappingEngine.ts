import type { GestureFeatures } from './GestureEngine';
import type { AudioParameters } from './AudioEngine';
import type { ScenePreset } from '../scenes/ScenePreset';
import { ParameterSmoother } from '../utils/math';

export class MappingEngine {
  private preset: ScenePreset | null = null;
  private gainSmoother = new ParameterSmoother(0.15);
  private freqSmoother = new ParameterSmoother(0.1);

  loadPreset(preset: ScenePreset) {
    this.preset = preset;
  }

  mapFeaturesToAudio(features: GestureFeatures): AudioParameters {
    const params: AudioParameters = {
      masterGain: 0.2,
      filterFreq: 2000,
      noiseDensity: 0.5,
      rainMix: 0,
      streamMix: 0
    };

    if (!this.preset) return params;

    const mapping = this.preset.mapping;
    const height = features.heightNormalized;
    const horizontal = features.horizontalPos;
    const openness = features.openness;

    // 根据预设映射
    switch (mapping.vertical) {
      case 'volume':
        params.masterGain = this.gainSmoother.update(height);
        break;
      case 'filterFreq':
        params.filterFreq = this.freqSmoother.update(200 + height * 3000);
        break;
    }

    switch (mapping.horizontal) {
      case 'filterFreq':
        params.filterFreq = this.freqSmoother.update(200 + horizontal * 4000);
        break;
    }

    if (mapping.openness === 'noiseDensity') {
      params.noiseDensity = openness;
    }

    // 捏合切换场景（由 App 层处理，此处仅返回）
    return params;
  }
}