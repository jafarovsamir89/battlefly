export type AudioEvent =
  | 'select'
  | 'charge'
  | 'launch'
  | 'impact'
  | 'shield'
  | 'destroy'
  | 'hyperjump'
  | 'score'
  | 'win'
  | 'lose';

export class AudioSystem {
  private enabled = false;
  private context: AudioContext | null = null;

  public get isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) this.ensureContext();
    return this.enabled;
  }

  public play(event: AudioEvent): void {
    if (!this.enabled) return;
    const context = this.ensureContext();
    if (!context) return;

    const settings: Record<AudioEvent, { frequency: number; duration: number; type: OscillatorType }> = {
      select: { frequency: 460, duration: 0.06, type: 'sine' },
      charge: { frequency: 260, duration: 0.11, type: 'triangle' },
      launch: { frequency: 150, duration: 0.18, type: 'sawtooth' },
      impact: { frequency: 82, duration: 0.15, type: 'square' },
      shield: { frequency: 720, duration: 0.16, type: 'sine' },
      destroy: { frequency: 58, duration: 0.32, type: 'sawtooth' },
      hyperjump: { frequency: 520, duration: 0.24, type: 'triangle' },
      score: { frequency: 820, duration: 0.12, type: 'sine' },
      win: { frequency: 980, duration: 0.36, type: 'sine' },
      lose: { frequency: 160, duration: 0.38, type: 'triangle' },
    };
    const setting = settings[event];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = setting.type;
    oscillator.frequency.value = setting.frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + setting.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + setting.duration + 0.02);
  }

  private ensureContext(): AudioContext | null {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return this.context;
    }

    const windowWithAudio = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = window.AudioContext ?? windowWithAudio.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    this.context = new AudioContextConstructor();
    return this.context;
  }
}
