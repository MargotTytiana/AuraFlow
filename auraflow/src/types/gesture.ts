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
