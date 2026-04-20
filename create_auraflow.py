#!/usr/bin/env python3
"""
AuraFlow - 非视觉交互式白噪音与专注环境生成器
全自动项目脚手架生成脚本
"""

import os
import shutil
from pathlib import Path

# 项目根目录名
PROJECT_ROOT = "auraflow"

# 定义所有需要创建的文件及其内容
FILES = {
    # ======================== 根目录配置文件 ========================
    "package.json": '''{
  "name": "auraflow",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@mediapipe/hands": "^0.4.1675469240",
    "@mediapipe/camera_utils": "^0.3.1675466862"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vite": "^5.0.12"
  }
}''',
    "tsconfig.json": '''{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}''',
    "vite.config.ts": '''import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    https: false, // 开发时可设为 true 测试摄像头（需证书）
    host: true
  },
  build: {
    target: 'es2020'
  }
});''',
    "manifest.json": '''{
  "name": "AuraFlow",
  "short_name": "AuraFlow",
  "description": "Gesture-controlled ambient soundscape for focus and meditation",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0a0f0f",
  "theme_color": "#2a5a5a",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}''',
    "service-worker.js": '''// 基础 Service Worker，用于 PWA 离线缓存
const CACHE_NAME = 'auraflow-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/styles.css',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});''',
    "index.html": '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>AuraFlow · 非视觉白噪音</title>
  <link rel="stylesheet" href="/src/styles.css">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#2a5a5a">
</head>
<body>
  <div id="app">
    <!-- 视频元素（隐藏，仅用于手势识别） -->
    <video id="input_video" style="display: none;"></video>
    
    <!-- 极简状态指示器 Canvas -->
    <canvas id="status_canvas" width="64" height="64"></canvas>
    
    <!-- 调试模式叠加层（仅当 URL 参数 ?debug 时显示） -->
    <canvas id="debug_canvas" class="debug-hidden"></canvas>
    
    <!-- 开始按钮（用于启动音频上下文） -->
    <button id="start_btn" class="start-button">▶ 启动体验</button>
    
    <!-- 场景切换（简单下拉菜单） -->
    <select id="scene_select" class="scene-select">
      <option value="meditation">🧘 深度冥想</option>
      <option value="focus">💡 专注心流</option>
      <option value="sleep">🌙 睡前助眠</option>
    </select>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>''',

    # ======================== src 目录 ========================
    "src/main.ts": '''import { App } from './App';

// 等待 DOM 加载完成后启动应用
window.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});''',
    "src/App.ts": '''import { GestureEngine } from './core/GestureEngine';
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
}''',
    "src/styles.css": '''* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: #0a0f0f;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: system-ui, -apple-system, sans-serif;
}

#app {
  position: relative;
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  text-align: center;
}

#status_canvas {
  width: 80px;
  height: 80px;
  margin: 20vh auto 20px;
  display: block;
  border-radius: 50%;
  background: rgba(42, 90, 90, 0.1);
  box-shadow: 0 0 30px rgba(0, 255, 200, 0.1);
}

#debug_canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
}
#debug_canvas.debug-hidden {
  display: none;
}

.start-button {
  background: #2a5a5a;
  color: #e0f0f0;
  border: none;
  border-radius: 40px;
  padding: 14px 32px;
  font-size: 1.2rem;
  font-weight: 500;
  letter-spacing: 1px;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(42, 90, 90, 0.4);
  transition: all 0.2s ease;
  margin: 20px 0;
}

.start-button:hover {
  background: #3a7a7a;
  transform: scale(1.02);
}

.start-button.running {
  background: #1a3a3a;
  box-shadow: inset 0 2px 5px rgba(0,0,0,0.2);
}

.scene-select {
  background: transparent;
  color: #a0c0c0;
  border: 1px solid #2a5a5a;
  border-radius: 30px;
  padding: 10px 20px;
  font-size: 1rem;
  cursor: pointer;
  outline: none;
  margin-top: 20px;
}

.scene-select option {
  background: #0a0f0f;
}''',

    # ======================== core 模块 ========================
    "src/core/GestureEngine.ts": '''import { Hands, Results } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export interface GestureFeatures {
  heightNormalized: number;    // 0~1，手部垂直位置（0=顶部，1=底部）
  openness: number;            // 手部张开程度（0~1）
  pinchStrength: number;       // 捏合强度（0~1）
  horizontalPos: number;       // 0~1 水平位置
  isFist: boolean;
  rawLandmarks?: any;          // 原始关键点（用于调试）
}

type ResultsCallback = (features: GestureFeatures | null) => void;

export class GestureEngine {
  private hands: Hands;
  private camera: Camera | null = null;
  private videoElement: HTMLVideoElement;
  private callback: ResultsCallback = () => {};
  private isActive = false;

  constructor() {
    this.videoElement = document.getElementById('input_video') as HTMLVideoElement;
    this.hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    
    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    });

    this.hands.onResults(this.processResults.bind(this));
  }

  private processResults(results: Results) {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0];
      const features = this.computeFeatures(landmarks);
      this.isActive = true;
      this.callback(features);
    } else {
      this.isActive = false;
      this.callback(null);
    }
  }

  private computeFeatures(landmarks: any[]): GestureFeatures {
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const pinkyTip = landmarks[20];
    const middleMcp = landmarks[9];

    // 高度：取手腕和中指掌骨的平均 y 值
    const height = (wrist.y + middleMcp.y) / 2;
    // 水平位置
    const horizontal = wrist.x;
    // 张开度
    const openness = Math.hypot(thumbTip.x - pinkyTip.x, thumbTip.y - pinkyTip.y);
    // 捏合度
    const pinch = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);
    
    // 简单握拳检测（所有指尖到手腕距离和）
    const fingerTips = [4, 8, 12, 16, 20];
    let sumDist = 0;
    fingerTips.forEach(idx => {
      sumDist += Math.hypot(landmarks[idx].x - wrist.x, landmarks[idx].y - wrist.y);
    });
    const isFist = sumDist < 0.8;

    return {
      heightNormalized: Math.min(1, Math.max(0, height)),
      openness: Math.min(1, openness / 0.4),
      pinchStrength: Math.min(1, Math.max(0, 1 - pinch / 0.15)),
      horizontalPos: horizontal,
      isFist,
      rawLandmarks: landmarks
    };
  }

  async start() {
    this.camera = new Camera(this.videoElement, {
      onFrame: async () => await this.hands.send({ image: this.videoElement }),
      width: 640,
      height: 480
    });
    await this.camera.start();
  }

  onResults(cb: ResultsCallback) {
    this.callback = cb;
  }

  isHandDetected(): boolean {
    return this.isActive;
  }
}''',
    "src/core/AudioEngine.ts": '''export interface AudioParameters {
  masterGain: number;        // 0~1
  filterFreq: number;        // 200~5000 Hz
  noiseDensity: number;      // 0~1
  rainMix: number;           // 0~1
  streamMix: number;         // 0~1
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private isStarted = false;

  constructor() {}

  async start() {
    if (this.isStarted) return;
    
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.filter = this.context.createBiquadFilter();
    this.noiseGain = this.context.createGain();

    // 创建白噪声
    const buffer = this.createWhiteNoiseBuffer();
    this.noiseSource = this.context.createBufferSource();
    this.noiseSource.buffer = buffer;
    this.noiseSource.loop = true;

    // 连接节点：noise -> noiseGain -> filter -> masterGain -> destination
    this.noiseSource.connect(this.noiseGain);
    this.noiseGain.connect(this.filter);
    this.filter.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);

    // 设置默认值
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2000;
    this.masterGain.gain.value = 0.2;

    this.noiseSource.start();
    this.isStarted = true;
  }

  private createWhiteNoiseBuffer(duration = 2): AudioBuffer {
    const sampleRate = this.context!.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = this.context!.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  applyParameters(params: Partial<AudioParameters>) {
    if (!this.isStarted || !this.context) return;

    if (params.masterGain !== undefined) {
      this.masterGain!.gain.linearRampToValueAtTime(
        params.masterGain * 0.5,
        this.context.currentTime + 0.05
      );
    }
    if (params.filterFreq !== undefined) {
      this.filter!.frequency.linearRampToValueAtTime(
        params.filterFreq,
        this.context.currentTime + 0.05
      );
    }
    if (params.noiseDensity !== undefined) {
      // 简单映射：密度越高，增益越大，同时可调节滤波器Q值
      this.noiseGain!.gain.linearRampToValueAtTime(
        params.noiseDensity * 0.8,
        this.context.currentTime + 0.05
      );
    }
    // 雨声、溪流混合可在此扩展（需加载采样，示例略）
  }

  fadeOut(duration: number = 1.0) {
    if (this.masterGain && this.context) {
      this.masterGain.gain.linearRampToValueAtTime(0, this.context.currentTime + duration);
    }
  }
}''',
    "src/core/MappingEngine.ts": '''import type { GestureFeatures } from './GestureEngine';
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
}''',

    # ======================== scenes 模块 ========================
    "src/scenes/ScenePreset.ts": '''export interface SceneMapping {
  vertical: 'volume' | 'filterFreq' | 'none';
  horizontal: 'filterFreq' | 'pan' | 'none';
  openness: 'noiseDensity' | 'none';
  pinch: 'sceneSwitch' | 'none';
}

export interface ScenePreset {
  name: string;
  audioSources: ('noise' | 'rain' | 'stream')[];
  mapping: SceneMapping;
}''',
    "src/scenes/presets/meditation.ts": '''import type { ScenePreset } from '../ScenePreset';

export const meditationPreset: ScenePreset = {
  name: '深度冥想',
  audioSources: ['noise', 'rain'],
  mapping: {
    vertical: 'volume',
    horizontal: 'none',
    openness: 'noiseDensity',
    pinch: 'sceneSwitch'
  }
};''',
    "src/scenes/presets/focus.ts": '''import type { ScenePreset } from '../ScenePreset';

export const focusPreset: ScenePreset = {
  name: '专注心流',
  audioSources: ['noise'],
  mapping: {
    vertical: 'none',
    horizontal: 'filterFreq',
    openness: 'none',
    pinch: 'none'
  }
};''',
    "src/scenes/presets/sleep.ts": '''import type { ScenePreset } from '../ScenePreset';

export const sleepPreset: ScenePreset = {
  name: '睡前助眠',
  audioSources: ['noise', 'rain', 'stream'],
  mapping: {
    vertical: 'volume',
    horizontal: 'none',
    openness: 'none',
    pinch: 'none'
  }
};''',

    # ======================== ui 模块 ========================
    "src/ui/StatusIndicator.ts": '''export class StatusIndicator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isActive = false;
  private isReady = false;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.draw();
  }

  setReady(ready: boolean) {
    this.isReady = ready;
    this.draw();
  }

  setActive(active: boolean) {
    this.isActive = active;
    this.draw();
  }

  private draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 背景圆环
    ctx.beginPath();
    ctx.arc(w/2, h/2, 20, 0, 2 * Math.PI);
    ctx.fillStyle = this.isReady ? '#1a3a3a' : '#2a2a2a';
    ctx.fill();
    ctx.strokeStyle = this.isActive ? '#6fcfcf' : '#3a5a5a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 内点
    ctx.beginPath();
    ctx.arc(w/2, h/2, 6, 0, 2 * Math.PI);
    ctx.fillStyle = this.isActive ? '#a0f0f0' : '#5a8a8a';
    ctx.fill();
  }
}''',
    "src/ui/DebugOverlay.ts": '''import type { GestureFeatures } from '../core/GestureEngine';

export class DebugOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private enabled = false;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.canvas.classList.toggle('debug-hidden', !enabled);
    if (enabled) {
      this.resize();
    }
  }

  update(features: GestureFeatures) {
    if (!this.enabled) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (features.rawLandmarks) {
      this.drawLandmarks(features.rawLandmarks);
    }
  }

  private drawLandmarks(landmarks: any[]) {
    const ctx = this.ctx;
    ctx.fillStyle = '#00ffaa';
    landmarks.forEach((pt: any) => {
      ctx.beginPath();
      ctx.arc(pt.x * this.canvas.width, pt.y * this.canvas.height, 4, 0, 2*Math.PI);
      ctx.fill();
    });
  }

  private resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
}''',

    # ======================== utils 模块 ========================
    "src/utils/math.ts": '''export class ParameterSmoother {
  private value: number;
  constructor(private alpha: number, initial: number = 0) {
    this.value = initial;
  }

  update(target: number): number {
    this.value = this.alpha * target + (1 - this.alpha) * this.value;
    return this.value;
  }
}''',
    "src/utils/camera.ts": '''export async function requestCameraPermission(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (err) {
    throw new Error('无法访问摄像头：' + err);
  }
}''',
}

# 空目录列表（确保目录存在）
DIRECTORIES = [
    "public/icons",
    "src/core",
    "src/scenes/presets",
    "src/ui",
    "src/utils",
]

def create_project():
    root = Path(PROJECT_ROOT)
    
    # 如果目录已存在，询问是否覆盖
    if root.exists():
        response = input(f"目录 '{PROJECT_ROOT}' 已存在。是否删除并重新创建？(y/N): ")
        if response.lower() == 'y':
            shutil.rmtree(root)
        else:
            print("操作取消。")
            return
    
    # 创建所有目录
    for d in DIRECTORIES:
        (root / d).mkdir(parents=True, exist_ok=True)
    
    # 写入所有文件
    for filepath, content in FILES.items():
        full_path = root / filepath
        full_path.write_text(content, encoding='utf-8')
    
    # 创建空的图标占位文件（可选）
    icon_dir = root / "public/icons"
    for size in [192, 512]:
        icon_file = icon_dir / f"icon-{size}.png"
        if not icon_file.exists():
            # 创建简单的1x1占位PNG（避免构建报错）
            # 这里只创建空白文本文件，实际开发需替换真实图标
            icon_file.write_bytes(b'')
    
    # 创建 favicon
    (root / "public/favicon.svg").write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="#2a5a5a"/>
  <circle cx="50" cy="50" r="25" fill="#a0f0f0"/>
</svg>''')
    
    print(f"✅ 项目 '{PROJECT_ROOT}' 创建成功！")
    print("\n下一步：")
    print(f"  cd {PROJECT_ROOT}")
    print("  npm install")
    print("  npm run dev")
    print("\n然后打开浏览器访问提示的地址，点击「启动体验」并授权摄像头。")

if __name__ == "__main__":
    create_project()