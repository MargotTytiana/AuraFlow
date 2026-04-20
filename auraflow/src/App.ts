import { GestureEngine } from './core/GestureEngine';
import { AudioEngine } from './core/AudioEngine';
import { MappingEngine } from './core/MappingEngine';
import { StatusIndicator } from './ui/StatusIndicator';
import { DebugOverlay } from './ui/DebugOverlay';
import type { GestureFeatures } from './core/GestureEngine';
import type { ScenePreset } from './scenes/ScenePreset';
import { meditationPreset } from './scenes/presets/meditation';
import { focusPreset } from './scenes/presets/focus';
import { sleepPreset } from './scenes/presets/sleep';

export class App {
  private gestureEngine: GestureEngine;
  private audioEngine: AudioEngine;
  private mappingEngine: MappingEngine;
  private statusIndicator: StatusIndicator;
  private debugOverlay: DebugOverlay;
  private currentPreset: ScenePreset;
  private isRunning = false;

  constructor() {
    this.gestureEngine = new GestureEngine();
    this.audioEngine = new AudioEngine();
    this.mappingEngine = new MappingEngine();
    this.statusIndicator = new StatusIndicator('status_canvas');
    this.debugOverlay = new DebugOverlay('debug_canvas');
    
    // 默认场景
    this.currentPreset = meditationPreset;
    this.mappingEngine.loadPreset(this.currentPreset);
  }

  async init() {
    // 设置手势数据回调
    this.gestureEngine.onResults((features: GestureFeatures | null) => {
      if (features) {
        this.statusIndicator.setActive(true);
        const params = this.mappingEngine.mapFeaturesToAudio(features);
        this.audioEngine.applyParameters(params);
        this.debugOverlay.update(features);
      } else {
        this.statusIndicator.setActive(false);
        // 手部丢失时可选择渐弱音量
        this.audioEngine.fadeOut(0.5);
      }
    });

    // 设置调试模式
    const isDebug = new URLSearchParams(window.location.search).has('debug');
    this.debugOverlay.setEnabled(isDebug);
    
    // UI 事件绑定
    this.bindUI();
    
    // 初始化摄像头
    await this.gestureEngine.start();
    this.statusIndicator.setReady(true);
  }

  private bindUI() {
    const startBtn = document.getElementById('start_btn') as HTMLButtonElement;
    const sceneSelect = document.getElementById('scene_select') as HTMLSelectElement;

    startBtn.addEventListener('click', async () => {
      if (!this.isRunning) {
        await this.audioEngine.start();
        this.isRunning = true;
        startBtn.textContent = '⏸ 运行中';
        startBtn.classList.add('running');
      }
    });

    sceneSelect.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value;
      switch (value) {
        case 'focus': this.currentPreset = focusPreset; break;
        case 'sleep': this.currentPreset = sleepPreset; break;
        default: this.currentPreset = meditationPreset;
      }
      this.mappingEngine.loadPreset(this.currentPreset);
    });
  }
}