import { soundOn } from './voice';

let ctx: AudioContext | null = null;
function tone(freqs: number[], type: OscillatorType = 'sine', gap = 0.1, len = 0.25, vol = 0.12) {
  if (!soundOn()) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx ?? new AC();
    const t = ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = ctx!.createOscillator(),
        g = ctx!.createGain(),
        s = t + i * gap;
      o.type = type;
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.exponentialRampToValueAtTime(vol, s + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, s + len);
      o.connect(g);
      g.connect(ctx!.destination);
      o.start(s);
      o.stop(s + len + 0.05);
    });
  } catch {
    /* no audio */
  }
}

export const ding = () => tone([660, 880]);
export const buzz = () => tone([220, 165], 'triangle');
export const pop = () => tone([620], 'sine', 0.1, 0.12, 0.08);
export const snap = () => tone([300, 180], 'triangle', 0.06, 0.12, 0.1);
export const cheer = () => tone([523, 659, 784, 1047], 'sine', 0.09, 0.3);
