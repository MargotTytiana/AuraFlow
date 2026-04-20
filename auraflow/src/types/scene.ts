/** 场景预设配置，被 MappingEngine / AppState 共同引用 */
export interface ScenePreset {
  id:   string;
  name: string;
  audioSources: ('noise' | 'rain' | 'stream')[];
  mapping: {
    vertical:   'volume' | 'filterFreq' | 'none';
    horizontal: 'pan'    | 'mix'         | 'none';
    openness:   'noiseDensity'            | 'none';
    pinch:      'rainMix' | 'sceneSwitch' | 'none';
  };
}
