export class StatusIndicator {
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
}