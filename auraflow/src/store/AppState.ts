/**
 * AppState
 * 全局共享状态，避免跨模块参数传递混乱。
 */
import type { ScenePreset } from '../types/scene';

export class AppState {
  currentScene: ScenePreset;
  isMuted      = false;
  debugMode    = new URLSearchParams(location.search).has('debug');
  sensitivity  = 0.8;

  constructor(defaultScene: ScenePreset) {
    this.currentScene = defaultScene;
  }

  setScene(preset: ScenePreset) {
    this.currentScene = preset;
  }
}
