/**
 * Read-aloud for every lesson.
 * English uses the browser's own voice. Tamil uses a recorded file when one is given
 * (many phones have no Tamil voice), then a Tamil browser voice, then waits silently.
 * The sound on/off choice is remembered per device.
 */
const KEY = 'karpoam:sound';
const hasTTS = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let on = true;
try { on = localStorage.getItem(KEY) !== 'off'; } catch { /* storage blocked: default on */ }

const listeners = new Set<(on: boolean) => void>();
export const soundOn = () => on;
export function setSound(v: boolean) {
  on = v;
  try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch { /* ignore */ }
  if (!v) hush();
  listeners.forEach((fn) => fn(v));
}
export const onSoundChange = (fn: (on: boolean) => void) => { listeners.add(fn); return () => listeners.delete(fn); };

const PREFS: Record<string, string[]> = {
  en: ['en-SG', 'en-GB', 'en-AU', 'en-IN', 'en-US'],
  ta: ['ta-IN', 'ta-SG', 'ta-LK', 'ta-MY'],
};
function pickVoice(lang: string): SpeechSynthesisVoice | null {
  try {
    const vs = speechSynthesis.getVoices();
    if (!vs.length) return null;
    const norm = (s: string) => s.replace('_', '-').toLowerCase();
    for (const p of PREFS[lang] ?? [lang]) {
      const v = vs.find((v) => norm(v.lang) === p.toLowerCase());
      if (v) return v;
    }
    return vs.find((v) => norm(v.lang).startsWith(lang)) ?? null;
  } catch { return null; }
}
if (hasTTS) { try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => {}; } catch { /* ignore */ } }

let audioEl: HTMLAudioElement | null = null;

export function hush() {
  try { if (hasTTS) speechSynthesis.cancel(); } catch { /* ignore */ }
  if (audioEl) { audioEl.pause(); audioEl = null; }
}

export interface SpeakOpts { lang?: 'en' | 'ta'; audio?: string; rate?: number }

/** Speak a sentence. Resolves when it has finished (or after a reading-time pause when sound is off). */
export function speak(text: string, opts: SpeakOpts = {}): Promise<void> {
  const lang = opts.lang ?? 'en';
  const est = Math.max(1100, text.length * (lang === 'ta' ? 95 : 70));
  return new Promise((resolve) => {
    let done = false;
    const fin = () => { if (!done) { done = true; resolve(); } };
    if (!on) { setTimeout(fin, est); return; }
    hush();
    if (opts.audio) {
      const a = new Audio(opts.audio);
      audioEl = a;
      a.onended = fin; a.onerror = () => speakTTS(text, lang, opts.rate, fin, est);
      a.play().catch(() => speakTTS(text, lang, opts.rate, fin, est));
      setTimeout(fin, est + 8000);
      return;
    }
    speakTTS(text, lang, opts.rate, fin, est);
  });
}

function speakTTS(text: string, lang: string, rate: number | undefined, fin: () => void, est: number) {
  const voice = hasTTS ? pickVoice(lang) : null;
  if (!hasTTS || (lang !== 'en' && !voice)) { setTimeout(fin, est); return; }
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate ?? 0.85; u.pitch = 1.08;
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-GB';
    u.onend = fin; u.onerror = fin;
    speechSynthesis.speak(u);
  } catch { fin(); }
  setTimeout(fin, est + 5000);
}

/** Fire-and-forget version for quick counting ("1", "2", "3"). */
export const say = (text: string, opts?: SpeakOpts) => { void speak(text, opts); };
