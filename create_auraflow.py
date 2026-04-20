#!/usr/bin/env python3
"""
AuraFlow 项目脚手架生成脚本
自动创建所有目录、文件，并写入初始内容。
"""

import os
import sys
import textwrap

# ─────────────────────────────────────────────
# 文件内容定义
# ─────────────────────────────────────────────

FILES = {

    # ── 入口 ──────────────────────────────────
    "index.html": textwrap.dedent("""\
        <!DOCTYPE html>
        <html lang="zh-CN">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <link rel="manifest" href="/manifest.json" />
            <title>AuraFlow</title>
          </head>
          <body>
            <canvas id="debug-canvas"></canvas>
            <video id="input_video" playsinline style="display:none"></video>
            <div id="status-indicator"></div>
            <script type="module" src="/src/main.ts"></script>
          </body>
        </html>
    """),

    "src/main.ts": textwrap.dedent("""\
        import { App } from './App';

        // AudioContext 必须在用户手势后启动
        const startBtn = document.createElement('button');
        startBtn.textContent = '开始体验';
        startBtn.id = 'start-btn';
        document.body.appendChild(startBtn);

        startBtn.addEventListener('click', async () => {
          startBtn.remove();
          const app = new App();
          await app.init();
        }, { once: true });
    """),

    "src/App.ts": textwrap.dedent("""\
        import { VisionCapture } from './core/VisionCapture';
        import { GestureAnalyzer } from './core/GestureAnalyzer';
        import { AudioEngine } from './core/AudioEngine';
        import { MappingEngine } from './core/MappingEngine';
        import { AppState } from './store/AppState';
        import { StatusIndicator } from './ui/StatusIndicator';
        import { DebugOverlay } from './ui/DebugOverlay';
        import { meditationPreset } from './scenes/presets/meditation';

        export class App {
          private vision!: VisionCapture;
          private analyzer!: GestureAnalyzer;
          private audio!: AudioEngine;
          private mapping!: MappingEngine;
          private state!: AppState;
          private indicator!: StatusIndicator;
          private debug!: DebugOverlay;

          async init() {
            this.state    = new AppState(meditationPreset);
            this.audio    = new AudioEngine();
            this.mapping  = new MappingEngine(this.audio, this.state);
            this.analyzer = new GestureAnalyzer();
            this.indicator = new StatusIndicator();
            this.debug    = new DebugOverlay();

            this.vision = new VisionCapture((landmarks) => {
              const features = this.analyzer.extract(landmarks);
              this.mapping.apply(features);
              this.indicator.setActive(true);
              if (this.state.debugMode) this.debug.draw(landmarks);
            }, () => {
              this.mapping.onHandLost();
              this.indicator.setActive(false);
            });

            await this.vision.start();
          }
        }
    """),

    "src/styles.css": textwrap.dedent("""\
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #0a0a0f;
          color: #fff;
          font-family: sans-serif;
          overflow: hidden;
          height: 100dvh;
        }

        #start-btn {
          position: fixed;
          inset: 0;
          margin: auto;
          width: 160px;
          height: 48px;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.07);
          color: #fff;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.2s;
        }
        #start-btn:hover { background: rgba(255,255,255,0.14); }

        #debug-canvas {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s;
        }
        #debug-canvas.visible { opacity: 1; }
    """),

    # ── core ──────────────────────────────────
    "src/core/VisionCapture.ts": textwrap.dedent("""\
        /**
         * VisionCapture
         * 摄像头捕获 + MediaPipe Hands 推理，输出原始关键点。
         * 将摄像头基础设施与业务逻辑彻底分离。
         */
        import { Hands, Results, NormalizedLandmark } from '@mediapipe/hands';
        import { Camera } from '@mediapipe/camera_utils';

        type LandmarkCallback = (landmarks: NormalizedLandmark[]) => void;
        type LostCallback     = () => void;

        export class VisionCapture {
          private hands!: Hands;
          private camera!: Camera;

          constructor(
            private onLandmarks: LandmarkCallback,
            private onLost: LostCallback,
          ) {}

          async start() {
            const video = document.getElementById('input_video') as HTMLVideoElement;

            this.hands = new Hands({
              locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
            });

            this.hands.setOptions({
              maxNumHands: 1,
              modelComplexity: 1,
              minDetectionConfidence: 0.8,
              minTrackingConfidence: 0.5,
            });

            this.hands.onResults((results: Results) => {
              if (results.multiHandLandmarks?.length) {
                this.onLandmarks(results.multiHandLandmarks[0]);
              } else {
                this.onLost();
              }
            });

            this.camera = new Camera(video, {
              onFrame: async () => this.hands.send({ image: video }),
              width: 640,
              height: 480,
            });

            await this.camera.start();
          }

          stop() {
            this.camera?.stop();
            this.hands?.close();
          }
        }
    """),

    "src/core/GestureAnalyzer.ts": textwrap.dedent("""\
        /**
         * GestureAnalyzer
         * 消费 MediaPipe 原始关键点，输出高语义手势特征。
         */
        import type { NormalizedLandmark } from '@mediapipe/hands';
        import type { GestureFeatures } from '../types/gesture';
        import { clamp, ema } from '../utils/math';

        export class GestureAnalyzer {
          private smoothers = {
            height:  ema(0.1),
            openness: ema(0.1),
            pinch:    ema(0.12),
          };

          extract(lm: NormalizedLandmark[]): GestureFeatures {
            const wrist    = lm[0];
            const thumbTip = lm[4];
            const indexTip = lm[8];
            const pinkyTip = lm[20];
            const midMcp   = lm[9];

            const rawHeight   = clamp((wrist.y + midMcp.y) / 2, 0, 1);
            const rawOpenness = Math.hypot(thumbTip.x - pinkyTip.x, thumbTip.y - pinkyTip.y);
            const rawPinch    = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y);

            const fingerTips = [4, 8, 12, 16, 20];
            const sumDist = fingerTips.reduce((s, i) =>
              s + Math.hypot(lm[i].x - wrist.x, lm[i].y - wrist.y), 0);

            return {
              heightNormalized: this.smoothers.height(rawHeight),
              openness:         clamp(this.smoothers.openness(rawOpenness / 0.5), 0, 1),
              pinchStrength:    clamp(1 - this.smoothers.pinch(rawPinch / 0.15), 0, 1),
              isFist:           sumDist < 0.8,
            };
          }
        }
    """),

    "src/core/AudioEngine.ts": textwrap.dedent("""\
        /**
         * AudioEngine
         * Web Audio API 节点图，包含白噪声生成器和采样播放器。
         * AudioContext 在外部用户手势触发后调用 resume()。
         */
        export class AudioEngine {
          readonly ctx: AudioContext;
          private masterGain: GainNode;
          private filter: BiquadFilterNode;
          private noiseSource: AudioBufferSourceNode | null = null;
          private rainSource:  AudioBufferSourceNode | null = null;
          private rainGain:    GainNode;
          private rainBuffer:  AudioBuffer | null = null;

          constructor() {
            this.ctx        = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.filter     = this.ctx.createBiquadFilter();
            this.rainGain   = this.ctx.createGain();

            this.filter.type            = 'lowpass';
            this.filter.frequency.value = 2000;

            // 节点图：滤波 → 总音量 → 输出
            this.filter.connect(this.masterGain);
            this.rainGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.loadRain();
          }

          // ── 白噪声 ────────────────────────────
          private buildNoiseBuffer(seconds = 2): AudioBuffer {
            const sr  = this.ctx.sampleRate;
            const buf = this.ctx.createBuffer(1, sr * seconds, sr);
            const ch  = buf.getChannelData(0);
            for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
            return buf;
          }

          setNoiseGain(value: number) {
            if (!this.noiseSource) {
              this.noiseSource        = this.ctx.createBufferSource();
              this.noiseSource.buffer = this.buildNoiseBuffer();
              this.noiseSource.loop   = true;
              this.noiseSource.connect(this.filter);
              this.noiseSource.start();
            }
            this.masterGain.gain.linearRampToValueAtTime(
              Math.max(0, value * 0.6),
              this.ctx.currentTime + 0.05,
            );
          }

          setFilterFrequency(freq: number) {
            this.filter.frequency.linearRampToValueAtTime(
              freq,
              this.ctx.currentTime + 0.05,
            );
          }

          // ── 雨声采样 ──────────────────────────
          private async loadRain() {
            try {
              const res = await fetch('/audio/rain.mp3');
              const raw = await res.arrayBuffer();
              this.rainBuffer = await this.ctx.decodeAudioData(raw);
            } catch (e) {
              console.warn('rain.mp3 未找到，跳过雨声加载', e);
            }
          }

          setRainGain(value: number) {
            if (!this.rainBuffer) return;
            if (!this.rainSource) {
              this.rainSource        = this.ctx.createBufferSource();
              this.rainSource.buffer = this.rainBuffer;
              this.rainSource.loop   = true;
              this.rainSource.connect(this.rainGain);
              this.rainSource.start();
            }
            this.rainGain.gain.linearRampToValueAtTime(
              Math.max(0, value),
              this.ctx.currentTime + 0.05,
            );
          }

          mute()   { this.masterGain.gain.linearRampToValueAtTime(0,   this.ctx.currentTime + 0.1); }
          unmute() { this.masterGain.gain.linearRampToValueAtTime(0.6, this.ctx.currentTime + 0.1); }

          async resume() { await this.ctx.resume(); }
        }
    """),

    "src/core/MappingEngine.ts": textwrap.dedent("""\
        /**
         * MappingEngine
         * 根据当前场景预设，将手势特征映射为音频参数。
         */
        import type { GestureFeatures } from '../types/gesture';
        import type { AudioEngine } from './AudioEngine';
        import type { AppState } from '../store/AppState';

        export class MappingEngine {
          constructor(
            private audio: AudioEngine,
            private state: AppState,
          ) {}

          apply(f: GestureFeatures) {
            if (f.isFist) { this.audio.mute(); return; }
            this.audio.unmute();

            const { mapping } = this.state.currentScene;

            if (mapping.vertical === 'volume') {
              // 手越高（y 越小）音量越大，翻转映射
              this.audio.setNoiseGain(1 - f.heightNormalized);
            }
            if (mapping.horizontal === 'filterFreq') {
              this.audio.setFilterFrequency(200 + 3800 * (1 - f.heightNormalized));
            }
            if (mapping.openness === 'noiseDensity') {
              this.audio.setNoiseGain(f.openness);
            }
            if (mapping.pinch === 'rainMix') {
              this.audio.setRainGain(f.pinchStrength * 0.5);
            }
          }

          onHandLost() {
            // 手离开时缓慢淡出
            this.audio.mute();
          }
        }
    """),

    # ── store ─────────────────────────────────
    "src/store/AppState.ts": textwrap.dedent("""\
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
    """),

    # ── types ─────────────────────────────────
    "src/types/gesture.ts": textwrap.dedent("""\
        /** 手势语义特征，由 GestureAnalyzer 输出 */
        export interface GestureFeatures {
          /** 手部垂直位置 0(顶) ~ 1(底) */
          heightNormalized: number;
          /** 手掌张开程度 0~1 */
          openness: number;
          /** 食指与拇指捏合强度 0~1 */
          pinchStrength: number;
          /** 是否握拳 */
          isFist: boolean;
        }
    """),

    "src/types/scene.ts": textwrap.dedent("""\
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
    """),

    # ── scenes ────────────────────────────────
    "src/scenes/presets/meditation.ts": textwrap.dedent("""\
        import type { ScenePreset } from '../../types/scene';

        export const meditationPreset: ScenePreset = {
          id:   'meditation',
          name: '深度冥想',
          audioSources: ['rain', 'noise'],
          mapping: {
            vertical:   'volume',
            horizontal: 'none',
            openness:   'noiseDensity',
            pinch:      'rainMix',
          },
        };
    """),

    "src/scenes/presets/focus.ts": textwrap.dedent("""\
        import type { ScenePreset } from '../../types/scene';

        export const focusPreset: ScenePreset = {
          id:   'focus',
          name: '专注心流',
          audioSources: ['noise'],
          mapping: {
            vertical:   'none',
            horizontal: 'filterFreq',
            openness:   'none',
            pinch:      'none',
          },
        };
    """),

    "src/scenes/presets/sleep.ts": textwrap.dedent("""\
        import type { ScenePreset } from '../../types/scene';

        export const sleepPreset: ScenePreset = {
          id:   'sleep',
          name: '助眠模式',
          audioSources: ['rain', 'stream'],
          mapping: {
            vertical:   'volume',
            horizontal: 'none',
            openness:   'none',
            pinch:      'rainMix',
          },
        };
    """),

    # ── ui ────────────────────────────────────
    "src/ui/StatusIndicator.ts": textwrap.dedent("""\
        /**
         * StatusIndicator
         * 极简状态光点：绿色 = 识别中，灰色 = 无手部。
         */
        export class StatusIndicator {
          private el: HTMLElement;

          constructor() {
            this.el = document.getElementById('status-indicator')!;
            Object.assign(this.el.style, {
              position:     'fixed',
              bottom:       '20px',
              right:        '20px',
              width:        '10px',
              height:       '10px',
              borderRadius: '50%',
              background:   '#555',
              transition:   'background 0.4s',
              opacity:      '0.7',
            });
          }

          setActive(active: boolean) {
            this.el.style.background = active ? '#4caf50' : '#555';
          }
        }
    """),

    "src/ui/DebugOverlay.ts": textwrap.dedent("""\
        /**
         * DebugOverlay
         * 仅在 ?debug=true 时启用，在 Canvas 上绘制手部关键点。
         */
        import type { NormalizedLandmark } from '@mediapipe/hands';

        export class DebugOverlay {
          private canvas: HTMLCanvasElement;
          private ctx:    CanvasRenderingContext2D;

          constructor() {
            this.canvas = document.getElementById('debug-canvas') as HTMLCanvasElement;
            this.ctx    = this.canvas.getContext('2d')!;
            this.canvas.width  = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.canvas.classList.add('visible');
          }

          draw(landmarks: NormalizedLandmark[]) {
            const { canvas: c, ctx } = this;
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.fillStyle = '#00ff88';
            landmarks.forEach((p) => {
              ctx.beginPath();
              ctx.arc(p.x * c.width, p.y * c.height, 4, 0, Math.PI * 2);
              ctx.fill();
            });
          }
        }
    """),

    # ── utils ─────────────────────────────────
    "src/utils/math.ts": textwrap.dedent("""\
        /** 将值限制在 [min, max] 区间 */
        export const clamp = (v: number, min = 0, max = 1) =>
          Math.max(min, Math.min(max, v));

        /**
         * 指数移动平均（EMA）平滑器工厂
         * alpha 越小越平滑，响应越慢；越大越跟手，但容易跳变。
         */
        export const ema = (alpha: number) => {
          let current = 0;
          return (target: number) => {
            current = alpha * target + (1 - alpha) * current;
            return current;
          };
        };

        /** 线性映射：将 [inMin, inMax] 映射到 [outMin, outMax] */
        export const lerp = (
          v: number,
          inMin: number, inMax: number,
          outMin: number, outMax: number,
        ) => outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);
    """),

    # ── 配置文件 ──────────────────────────────
    "package.json": textwrap.dedent("""\
        {
          "name": "auraflow",
          "version": "0.1.0",
          "private": true,
          "scripts": {
            "dev":     "vite",
            "build":   "tsc && vite build",
            "preview": "vite preview"
          },
          "dependencies": {
            "@mediapipe/camera_utils": "^0.3.1675466862",
            "@mediapipe/hands":        "^0.4.1675469240"
          },
          "devDependencies": {
            "typescript":      "^5.4.0",
            "vite":            "^5.2.0",
            "vite-plugin-pwa": "^0.19.0"
          }
        }
    """),

    "tsconfig.json": textwrap.dedent("""\
        {
          "compilerOptions": {
            "target":            "ES2020",
            "module":            "ESNext",
            "moduleResolution":  "bundler",
            "strict":            true,
            "noEmit":            true,
            "skipLibCheck":      true,
            "baseUrl":           ".",
            "paths": {
              "@/*": ["src/*"]
            }
          },
          "include": ["src"]
        }
    """),

    "vite.config.ts": textwrap.dedent("""\
        import { defineConfig } from 'vite';
        import { VitePWA }     from 'vite-plugin-pwa';

        export default defineConfig({
          plugins: [
            VitePWA({
              // Service Worker 由 Workbox 自动生成，无需手写
              registerType: 'autoUpdate',
              manifest: false,             // 使用 public/manifest.json
              workbox: {
                globPatterns: ['**/*.{js,css,html,mp3,png,svg}'],
              },
            }),
          ],
        });
    """),

    # ── public ────────────────────────────────
    # manifest.json 放在 public/，Vite 会原样复制到构建输出
    "public/manifest.json": textwrap.dedent("""\
        {
          "name":       "AuraFlow",
          "short_name": "AuraFlow",
          "start_url":  "/",
          "display":    "standalone",
          "orientation": "portrait",
          "background_color": "#0a0a0f",
          "theme_color":      "#0a0a0f",
          "icons": [
            { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
            { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
          ]
        }
    """),

    # 占位音频（实际需替换为真实 mp3）
    "public/audio/.gitkeep": "",

    # PWA 图标占位
    "public/icons/.gitkeep": "",

    # README
    "README.md": textwrap.dedent("""\
        # AuraFlow

        > 通过手势实时控制环境音景的 Web 应用

        ## 快速开始

        ```bash
        npm install
        npm run dev
        ```

        访问 http://localhost:5173，点击"开始体验"，
        将手放在摄像头前即可开始控制声音。

        ## 调试模式

        访问 `?debug=true` 开启关键点可视化。

        ## 音频资源

        将 `rain.mp3`、`stream.mp3` 放入 `public/audio/`。

        ## 项目结构

        ```
        src/
        ├── core/          # VisionCapture / GestureAnalyzer / AudioEngine / MappingEngine
        ├── scenes/        # 场景预设（meditation / focus / sleep）
        ├── store/         # AppState 全局状态
        ├── types/         # 共享 TypeScript 接口
        ├── ui/            # StatusIndicator / DebugOverlay
        └── utils/         # math 工具函数

        public/
        ├── audio/         # rain.mp3 / stream.mp3（需自行添加）
        ├── icons/         # PWA 图标
        └── manifest.json  # PWA 清单（Vite 原样复制）
        ```
    """),
}


# ─────────────────────────────────────────────
# 需要删除的旧文件（根据架构建议）
# ─────────────────────────────────────────────

FILES_TO_REMOVE = [
    "src/utils/camera.ts",       # 职责已并入 VisionCapture.ts
    "src/core/GestureEngine.ts", # 已拆分为 VisionCapture + GestureAnalyzer
    "service-worker.js",         # 改由 vite-plugin-pwa (Workbox) 自动生成
    "manifest.json",             # 移到 public/manifest.json
]


# ─────────────────────────────────────────────
# 主逻辑
# ─────────────────────────────────────────────

def main():
    # 目标目录：脚本所在目录 / auraflow
    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "auraflow")

    print(f"\n🚀  创建项目目录：{base}\n")

    created_dirs  = 0
    created_files = 0
    removed_files = 0
    skipped_files = 0

    # 1. 创建文件
    for rel_path, content in FILES.items():
        abs_path = os.path.join(base, rel_path)
        dir_path = os.path.dirname(abs_path)

        if not os.path.exists(dir_path):
            os.makedirs(dir_path, exist_ok=True)
            print(f"  📁  mkdir  {os.path.relpath(dir_path, base)}/")
            created_dirs += 1

        if os.path.exists(abs_path):
            print(f"  ⏭   skip   {rel_path}  (已存在)")
            skipped_files += 1
        else:
            with open(abs_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"  ✅  create {rel_path}")
            created_files += 1

    # 2. 删除旧文件
    print("\n🗑   清理旧文件（架构建议中需移除的）：")
    for rel_path in FILES_TO_REMOVE:
        abs_path = os.path.join(base, rel_path)
        if os.path.exists(abs_path):
            os.remove(abs_path)
            print(f"  🗑   remove {rel_path}")
            removed_files += 1
        else:
            print(f"  —   not found (跳过) {rel_path}")

    # 3. 汇总
    print(f"""
{'─'*50}
✅  完成！
   创建目录：{created_dirs}
   创建文件：{created_files}
   跳过文件：{skipped_files}
   删除文件：{removed_files}

📂  项目位于：{base}

下一步：
  cd auraflow
  npm install
  npm run dev
{'─'*50}
""")


if __name__ == "__main__":
    main()