export interface SceneMapping {
  vertical: 'volume' | 'filterFreq' | 'none';
  horizontal: 'filterFreq' | 'pan' | 'none';
  openness: 'noiseDensity' | 'none';
  pinch: 'sceneSwitch' | 'none';
}

export interface ScenePreset {
  name: string;
  audioSources: ('noise' | 'rain' | 'stream')[];
  mapping: SceneMapping;
}