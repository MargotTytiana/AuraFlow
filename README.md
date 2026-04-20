
# 🌊 AuraFlow · Non-Visual Interactive White Noise & Focus Soundscape Generator

![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Vite](https://img.shields.io/badge/Vite-5.0-646cff)
![MediaPipe](https://img.shields.io/badge/MediaPipe-Hands-00e5a0)

> **Free your eyes. Shape your focus soundscape with body movement.**  
> AuraFlow is a gesture-controlled ambient sound generator. No screen staring required—just move your hands to modulate white noise, rain, and natural soundscapes in real time. Designed for meditation, deep work, and sleep.

---

## ✨ Features

- **🖐️ Real‑time Hand Tracking** – Powered by MediaPipe Hands, detecting 21 hand landmarks with <30ms latency.
- **🎛️ Intuitive Sound Sculpting** – Raise your hand to increase volume, move horizontally to adjust filter cutoff, make a fist to mute.
- **🧘 Multi‑Scene Presets** – Built‑in modes: *Deep Meditation*, *Focus Flow*, and *Sleep Aid*.
- **👁️ Screen‑Free Interaction** – Minimal status indicator; no blue light or UI distractions.
- **🐛 Debug Mode** – Append `?debug` to the URL to visualize hand landmarks for development.
- **📱 PWA Support** – Installable to your home screen for a near‑native experience.

---

## 🎬 Use Cases

| Scenario | Description | Suggested Gesture |
| :--- | :--- | :--- |
| **🧘 Deep Meditation** | Palm up/down controls volume; hand openness adjusts noise density | Slow, steady hand movements |
| **💡 Focus Flow** | Move hand left/right to change filter frequency, creating "auditory sharpness" | Horizontal panning |
| **🌙 Sleep Aid** | Simplified gestures; system tracks subtle body movement, fades sound to silence when still | Stillness / slow lowering |

> More scenes can be added easily—see [Custom Scene Presets](#-custom-scene-presets).

---

## 🛠️ Tech Stack

| Module | Technology | Purpose |
| :--- | :--- | :--- |
| Computer Vision | **MediaPipe Hands** | Hand landmark detection & tracking |
| Audio Synthesis | **Web Audio API** | Dynamic white noise generation, filtering |
| Frontend Framework | **TypeScript + Vite** | Type safety, lightning‑fast HMR |
| UI Rendering | **Canvas 2D** | Status indicator & debug overlay |
| PWA | **Service Worker + Manifest** | Offline caching & home screen installation |

---

## 📦 Quick Start

### Prerequisites
- Node.js 18+
- Modern browser (Chrome / Edge / Safari 15+) with `getUserMedia` support

### Installation & Running

```bash
# 1. Clone the repository (or use the Python scaffolding script)
git clone https://github.com/yourname/auraflow.git
cd auraflow

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev

Open the local URL shown in your terminal (e.g., `http://localhost:5173`), click **「▶ Start Experience」** and grant camera permission to begin.

### Production Build

```bash
npm run build
# Outputs to dist/ — ready to be deployed to any static hosting service.
```

---

## 🧭 How to Use

1. **Start Audio**  
   Click the **「▶ Start Experience」** button. This initializes the `AudioContext` (required by browser autoplay policies).

2. **Gesture Controls**  
   - **Vertical palm movement** → Master volume (Meditation / Sleep modes)  
   - **Horizontal palm movement** → Low‑pass filter frequency (Focus mode)  
   - **Open / close hand** → Adjust white noise density  
   - **Pinch (thumb & index finger)** → Cycle to next scene (in some modes)  
   - **Make a fist** → Mute

3. **Switch Scenes**  
   Use the dropdown at the bottom to change between presets.

4. **Status Indicator**  
   - Gray ring → Waiting for hand detection  
   - Green outer ring + bright inner dot → Hand tracked, audio responding

5. **Debug Mode**  
   Add `?debug` to the URL to overlay hand landmarks and connections on the screen.

---

## 🎨 Custom Scene Presets

You can create new preset files in `src/scenes/presets/` and register them inside `App.ts`.

**Example Preset (`myPreset.ts`):**

```typescript
import type { ScenePreset } from '../ScenePreset';

export const myPreset: ScenePreset = {
  name: 'My Focus Mode',
  audioSources: ['noise', 'rain'],     // Currently only 'noise' is fully implemented
  mapping: {
    vertical: 'volume',                // Vertical movement → volume
    horizontal: 'filterFreq',          // Horizontal movement → filter frequency
    openness: 'noiseDensity',          // Hand openness → noise density
    pinch: 'none'                      // Pinch does nothing
  }
};
```

Then update the scene dropdown in `App.ts` to include your new option.

---

## 🧪 Project Architecture

```
auraflow/
├── public/                 # Static assets & PWA icons
├── src/
│   ├── core/               # Core engines
│   │   ├── GestureEngine.ts    # Hand tracking & feature extraction
│   │   ├── AudioEngine.ts      # Web Audio synthesis & control
│   │   └── MappingEngine.ts    # Gesture → audio parameter mapping
│   ├── scenes/             # Scene preset configurations
│   ├── ui/                 # Minimal UI components
│   ├── utils/              # Utilities (smoothing, camera, etc.)
│   ├── App.ts              # Main controller
│   ├── main.ts             # Entry point
│   └── styles.css          # Global styles
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── manifest.json           # PWA manifest
```

Data flows unidirectionally: `GestureEngine` → `App` → `MappingEngine` → `AudioEngine`. This makes testing and extending the system straightforward.

---

## 🔧 Roadmap

- [ ] Integrate real rain / stream audio samples (currently pure white noise synthesis)
- [ ] Full‑body pose estimation (MediaPipe Pose) for breath rate detection
- [ ] Bluetooth heart rate monitor integration – adapt soundscape based on heart rate
- [ ] Capacitor builds for native iOS / Android with lock‑screen background audio
- [ ] Multi‑user collaborative mode (two hands shaping one soundscape together)

---

## 🤝 Contributing

Issues and pull requests are welcome! Please follow these guidelines:

1. **Keep code style consistent** – Prettier config may be added later.
2. **Use feature branches** – Create `feature/xxx` from `main`.
3. **Test your changes** – Ensure `npm run build` passes and basic gesture tracking still works.
4. **Update documentation** – If you add new presets or change mapping logic, reflect it in the README.

---

## 📄 License

This project is open‑source under the [MIT License](LICENSE).

---

## 🙏 Acknowledgements

- [MediaPipe](https://developers.google.com/mediapipe) – On‑device machine learning made accessible
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) – Powerful browser audio processing
- Inspiration: The Theremin, various gesture‑controlled art projects

---

**🌟 If you like this project, please give it a star!**  
**💬 Questions or suggestions? Open an [Issue](https://github.com/yourname/auraflow/issues).**
```

This English README maintains the exact structure, formatting, and technical depth of the original Chinese version, making it suitable for an international audience and GitHub repository.