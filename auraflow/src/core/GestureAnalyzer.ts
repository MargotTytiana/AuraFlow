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
