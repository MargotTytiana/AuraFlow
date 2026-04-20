export class ParameterSmoother {
  private value: number;
  constructor(private alpha: number, initial: number = 0) {
    this.value = initial;
  }

  update(target: number): number {
    this.value = this.alpha * target + (1 - this.alpha) * this.value;
    return this.value;
  }
}