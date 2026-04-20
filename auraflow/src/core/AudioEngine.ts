export interface AudioParameters {
  masterGain: number;        // 0~1
  filterFreq: number;        // 200~5000 Hz
  noiseDensity: number;      // 0~1
  rainMix: number;           // 0~1
  streamMix: number;         // 0~1
}

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private isStarted = false;

  constructor() {}

  async start() {
    if (this.isStarted) return;
    
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.filter = this.context.createBiquadFilter();
    this.noiseGain = this.context.createGain();

    // 创建白噪声
    const buffer = this.createWhiteNoiseBuffer();
    this.noiseSource = this.context.createBufferSource();
    this.noiseSource.buffer = buffer;
    this.noiseSource.loop = true;

    // 连接节点：noise -> noiseGain -> filter -> masterGain -> destination
    this.noiseSource.connect(this.noiseGain);
    this.noiseGain.connect(this.filter);
    this.filter.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);

    // 设置默认值
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2000;
    this.masterGain.gain.value = 0.2;

    this.noiseSource.start();
    this.isStarted = true;
  }

  private createWhiteNoiseBuffer(duration = 2): AudioBuffer {
    const sampleRate = this.context!.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = this.context!.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  applyParameters(params: Partial<AudioParameters>) {
    if (!this.isStarted || !this.context) return;

    if (params.masterGain !== undefined) {
      this.masterGain!.gain.linearRampToValueAtTime(
        params.masterGain * 0.5,
        this.context.currentTime + 0.05
      );
    }
    if (params.filterFreq !== undefined) {
      this.filter!.frequency.linearRampToValueAtTime(
        params.filterFreq,
        this.context.currentTime + 0.05
      );
    }
    if (params.noiseDensity !== undefined) {
      // 简单映射：密度越高，增益越大，同时可调节滤波器Q值
      this.noiseGain!.gain.linearRampToValueAtTime(
        params.noiseDensity * 0.8,
        this.context.currentTime + 0.05
      );
    }
    // 雨声、溪流混合可在此扩展（需加载采样，示例略）
  }

  fadeOut(duration: number = 1.0) {
    if (this.masterGain && this.context) {
      this.masterGain.gain.linearRampToValueAtTime(0, this.context.currentTime + duration);
    }
  }
}