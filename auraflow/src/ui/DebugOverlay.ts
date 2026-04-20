import type { GestureFeatures } from '../core/GestureEngine';

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
}