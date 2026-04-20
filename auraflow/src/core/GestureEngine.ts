import { Hands, Results } from '@mediapipe/hands';
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
}