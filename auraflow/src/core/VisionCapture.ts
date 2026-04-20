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
