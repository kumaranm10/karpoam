import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type VoiceMod = typeof import('../../src/lib/voice');
async function fresh(): Promise<VoiceMod> {
  vi.resetModules();
  return import('../../src/lib/voice');
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('sound setting', () => {
  it('is on by default and remembers off', async () => {
    const v = await fresh();
    expect(v.soundOn()).toBe(true);
    v.setSound(false);
    expect(localStorage.getItem('karpoam:sound')).toBe('off');
    const again = await fresh();
    expect(again.soundOn()).toBe(false);
  });
  it('tells listeners and lets them unsubscribe', async () => {
    const v = await fresh();
    const seen: boolean[] = [];
    const off = v.onSoundChange((on) => seen.push(on));
    v.setSound(false);
    off();
    v.setSound(true);
    expect(seen).toEqual([false]);
  });
});

describe('speak() without a speech engine', () => {
  it('still resolves after a reading pause, so lessons never hang', async () => {
    const v = await fresh();
    let done = false;
    void v.speak('Hello there').then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(10000);
    expect(done).toBe(true);
  });
  it('resolves when sound is off', async () => {
    const v = await fresh();
    v.setSound(false);
    const p = v.speak('Quiet please');
    await vi.advanceTimersByTimeAsync(5000);
    await expect(p).resolves.toBeUndefined();
  });
});

describe('speak() with a speech engine', () => {
  function stubSpeech(voices: { lang: string; name: string }[]) {
    const spoken: { text: string; lang: string; voice?: { lang: string } }[] = [];
    class Utt {
      text: string;
      lang = '';
      rate = 1;
      pitch = 1;
      voice?: { lang: string };
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(t: string) {
        this.text = t;
      }
    }
    const synth = {
      getVoices: () => voices,
      onvoiceschanged: null as unknown,
      cancel: vi.fn(),
      speak: vi.fn((u: Utt) => {
        spoken.push({ text: u.text, lang: u.lang, voice: u.voice });
        setTimeout(() => u.onend?.(), 10);
      }),
    };
    vi.stubGlobal('speechSynthesis', synth);
    vi.stubGlobal('SpeechSynthesisUtterance', Utt);
    return { spoken, synth };
  }

  it('prefers a Singapore English voice', async () => {
    const { spoken } = stubSpeech([
      { lang: 'en-US', name: 'US' },
      { lang: 'en_SG', name: 'SG' },
    ]);
    const v = await fresh();
    const p = v.speak('Seventy-four');
    await vi.advanceTimersByTimeAsync(50);
    await p;
    expect(spoken[0].text).toBe('Seventy-four');
    expect(spoken[0].lang).toBe('en_SG');
  });

  it('does not read Tamil with an English voice when no Tamil voice exists', async () => {
    const { synth } = stubSpeech([{ lang: 'en-GB', name: 'GB' }]);
    const v = await fresh();
    const p = v.speak('வணக்கம்', { lang: 'ta' });
    await vi.advanceTimersByTimeAsync(5000);
    await p;
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('plays a recorded file first when one is given', async () => {
    stubSpeech([]);
    const play = vi.fn(() => Promise.resolve());
    class FakeAudio {
      src: string;
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(src: string) {
        this.src = src;
        setTimeout(() => this.onended?.(), 20);
      }
      play = play;
      pause = vi.fn();
    }
    vi.stubGlobal('Audio', FakeAudio);
    const v = await fresh();
    const p = v.speak('அம்மா', { lang: 'ta', audio: '/audio/ta/x.mp3' });
    await vi.advanceTimersByTimeAsync(50);
    await p;
    expect(play).toHaveBeenCalledOnce();
  });
});
