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

src/types/gesture.ts
src/types/scene.ts
src/utils/math.ts
src/core/VisionCapture.ts
src/core/GestureAnalyzer.ts
src/core/AudioEngine.ts
src/scenes/presets/meditation.ts
src/scenes/presets/focus.ts
src/scenes/presets/sleep.ts
src/store/AppState.ts
src/core/MappingEngine.ts
src/ui/StatusIndicator.ts
src/ui/DebugOverlay.ts
src/App.ts

src/main.ts
src/styles.css
index.html
public/manifest.json
vite.config.ts
tsconfig.json
package.json
README.md