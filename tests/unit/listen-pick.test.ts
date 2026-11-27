import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mount, { type LpItem, pickOptions } from '../../src/widgets/listen-pick';
import { btn, click, mountRoot, steps } from './helpers';

/** A fake voice: records what was played (text + audio file) so tests know which word the child heard. */
const voice = vi.hoisted(() => ({
  on: true,
  heard: [] as { text: string; audio?: string }[],
  listeners: new Set<(on: boolean) => void>(),
}));
vi.mock('../../src/lib/voice', () => ({
  soundOn: () => voice.on,
  onSoundChange: (fn: (on: boolean) => void) => {
    voice.listeners.add(fn);
    return () => voice.listeners.delete(fn);
  },
  speak: (text: string, opts: { audio?: string } = {}) => {
    voice.heard.push({ text, audio: opts.audio });
    return Promise.resolve();
  },
  say: () => {},
  hush: () => {},
}));

const ITEMS: LpItem[] = [
  { id: 'cat', icon: '🐱', name: 'cat', why: 'A cat says meow.' },
  { id: 'dog', icon: '🐶', name: 'dog' },
  { id: 'bus', icon: '🚌', name: 'bus', say: 'a bus' },
  { id: 'fish', icon: '🐟', name: 'fish', audio: '/audio/en/fish.mp3' },
  { id: 'cup', icon: '🥤', name: 'cup' },
  { id: 'sun', icon: '☀️', name: 'sun' },
];
const P = {
  items: ITEMS,
  story: [
    { item: 'cat', text: 'A <b>cat</b>.', say: 'This is a cat.' },
    { item: 'bus', text: 'A <b>bus</b>.' },
  ],
};
const byName = new Map(ITEMS.map((i) => [i.name, i]));
/** The item whose own word was played last. */
const lastWord = () => {
  for (let k = voice.heard.length - 1; k >= 0; k--) {
    const h = voice.heard[k];
    const it = ITEMS.find((i) => (i.audio ? h.audio === i.audio : !h.audio && (i.say ?? i.name) === h.text));
    if (it) return it;
  }
  return undefined;
};

let root: HTMLElement;
function setup(params: Record<string, unknown> = P, lang: 'en' | 'ta' = 'en') {
  root = mountRoot();
  mount(root, params, { lang, title: 'Listen' });
}
beforeEach(() => {
  vi.useFakeTimers();
  voice.on = true;
  voice.heard = [];
  voice.listeners.clear();
  setup();
});
afterEach(() => vi.useRealTimers());

describe('pickOptions', () => {
  it('always holds the target once, with different others (200 rounds)', () => {
    for (let q = 0; q < 200; q++) {
      const target = ITEMS[q % ITEMS.length];
      const n = 3 + (q % 2);
      const o = pickOptions(ITEMS, target, n);
      expect(o).toHaveLength(n);
      expect(o.filter((x) => x.id === target.id)).toHaveLength(1);
      expect(new Set(o.map((x) => x.id)).size).toBe(n);
    }
  });
});

describe('listen-pick', () => {
  it('has See, Try and Check steps', () => {
    expect(steps(root)).toHaveLength(3);
  });

  it('see: intro, one screen per example, then your turn; plays each word', async () => {
    const s = steps(root)[0];
    click(btn(s, 'Start'));
    expect(s.querySelectorAll('.dots span')).toHaveLength(P.story.length + 2);
    click(btn(s, 'Next'));
    await vi.advanceTimersByTimeAsync(10);
    expect(s.querySelector('.lp-name')?.textContent).toBe('cat');
    expect(voice.heard.map((h) => h.text)).toContain('This is a cat.');
    expect(lastWord()?.id).toBe('cat');
    click(btn(s, 'Next'));
    await vi.advanceTimersByTimeAsync(10);
    expect(lastWord()?.id).toBe('bus');
    expect(s.querySelectorAll('.lp-row .lp-icon')).toHaveLength(1);
    click(btn(s, 'Next'));
    expect(s.querySelector('.say')?.textContent).toContain('Your turn');
    expect(s.querySelectorAll('.lp-row .lp-icon')).toHaveLength(2);
  });

  it('see: without a story, shows the first 3 items', () => {
    setup({ items: ITEMS });
    const s = steps(root)[0];
    expect(s.querySelectorAll('.dots span')).toHaveLength(5);
  });

  it('try: tapping what you hear finds every item', async () => {
    const t = steps(root)[1];
    click(btn(t, 'Play again'));
    for (let i = 0; i < ITEMS.length; i++) {
      const target = lastWord()!;
      const opts = [...t.querySelectorAll<HTMLButtonElement>('.lp-opt')];
      expect(opts).toHaveLength(4);
      expect(opts.filter((o) => o.getAttribute('aria-label') === target.name)).toHaveLength(1);
      click(opts.find((o) => o.getAttribute('aria-label') === target.name));
      await vi.advanceTimersByTimeAsync(10);
    }
    expect(t.querySelector('.lp-progress')?.textContent).toBe(`${ITEMS.length} of ${ITEMS.length} found`);
    expect(t.querySelector('.say')?.textContent).toContain('All found');
    expect(btn(t, 'Play again')?.disabled).toBe(true);
    click(btn(t, 'New game'));
    expect(t.querySelector('.lp-progress')?.textContent).toBe(`0 of ${ITEMS.length} found`);
  });

  it('try: a wrong tap does not count and shows the word as a hint', async () => {
    const t = steps(root)[1];
    const hint = t.querySelector('.lp-hint')!;
    expect(hint.textContent).toBe('');
    click(btn(t, 'Play again'));
    const target = lastWord()!;
    const wrong = [...t.querySelectorAll<HTMLButtonElement>('.lp-opt')].find((o) => o.getAttribute('aria-label') !== target.name)!;
    click(wrong);
    expect(wrong.disabled).toBe(true);
    expect(t.querySelector('.say')?.textContent).toContain('Not quite');
    expect(hint.textContent).toBe(target.name);
    expect(t.querySelector('.lp-progress')?.textContent).toBe(`0 of ${ITEMS.length} found`);
  });

  it('try + check: with sound off the word is shown straight away', () => {
    voice.on = false;
    setup();
    const [, t, c] = steps(root);
    expect(t.querySelector('.lp-hint')?.textContent).not.toBe('');
    expect(c.querySelector('.lp-hint')?.textContent).not.toBe('');
    const hinted = byName.get(c.querySelector('.lp-hint')!.textContent!)!;
    expect([...c.querySelectorAll('.qopt')].filter((o) => o.getAttribute('aria-label') === hinted.name)).toHaveLength(1);
  });

  it('turning sound off mid-lesson shows the hint', () => {
    const [, t, c] = steps(root);
    voice.on = false;
    for (const fn of voice.listeners) fn(false);
    expect(t.querySelector('.lp-hint')?.textContent).not.toBe('');
    expect(c.querySelector('.lp-hint')?.textContent).not.toBe('');
  });

  it('check: every question has exactly one right answer (200 questions)', () => {
    const c = steps(root)[2];
    for (let q = 0; q < 200; q++) {
      click(btn(c, 'Next question'));
      const target = lastWord()!;
      const opts = [...c.querySelectorAll<HTMLElement>('.qopt')];
      expect(opts).toHaveLength(4);
      expect(new Set(opts.map((o) => o.getAttribute('aria-label'))).size).toBe(4);
      expect(opts.filter((o) => o.getAttribute('aria-label') === target.name)).toHaveLength(1);
    }
  });

  it('check: answers are scored and explained', async () => {
    const c = steps(root)[2];
    click(btn(c, 'Play again'));
    const target = lastWord()!;
    const opts = [...c.querySelectorAll<HTMLButtonElement>('.qopt')];
    click(opts.find((o) => o.getAttribute('aria-label') !== target.name));
    await vi.advanceTimersByTimeAsync(10);
    expect(c.querySelector('.qfb')?.className).toBe('qfb no');
    expect(c.querySelector('.qfb')?.textContent).toContain(`You heard ${target.name}`);
    expect(c.querySelector('.score')?.textContent).toBe('0 of 1 right');
    expect(opts.every((o) => o.disabled)).toBe(true);
    expect(c.querySelectorAll('.qopt.right')).toHaveLength(1);
    // A right answer (keep asking until the target has a `why`, to see it read out).
    for (let q = 0; q < 200; q++) {
      click(btn(c, 'Next question'));
      if (lastWord()!.why) break;
    }
    const t2 = lastWord()!;
    click([...c.querySelectorAll<HTMLButtonElement>('.qopt')].find((o) => o.getAttribute('aria-label') === t2.name));
    await vi.advanceTimersByTimeAsync(10);
    expect(c.querySelector('.qfb')?.className).toBe('qfb ok');
    expect(c.querySelector('.qfb')?.textContent).toContain(t2.why!);
    expect(voice.heard.at(-1)?.text).toBe(t2.why);
    expect(c.querySelector('.score')?.textContent).toBe('1 of 2 right');
  });

  it('uses 3 choices when asked, and never more than the items', () => {
    setup({ items: ITEMS, choices: 3 });
    expect(steps(root)[2].querySelectorAll('.qopt')).toHaveLength(3);
    setup({ items: ITEMS.slice(0, 3) });
    expect(steps(root)[1].querySelectorAll('.lp-opt')).toHaveLength(3);
  });

  it('Tamil: plays the MP3 for the item', async () => {
    const ta: LpItem[] = [
      { id: 'a', icon: 'அ', name: 'அம்மா', audio: '/audio/ta/x/a.mp3' },
      { id: 'aa', icon: 'ஆ', name: 'ஆடு', audio: '/audio/ta/x/aa.mp3' },
      { id: 'i', icon: 'இ', name: 'இலை', audio: '/audio/ta/x/i.mp3' },
      { id: 'ii', icon: 'ஈ', name: 'ஈ', audio: '/audio/ta/x/ii.mp3' },
    ];
    setup({ items: ta, ask: 'கேட்டு தொடு.' }, 'ta');
    const t = steps(root)[1];
    expect(t.querySelector('.say')?.textContent).toBe('கேட்டு தொடு.');
    click(btn(t, 'Play again'));
    expect(voice.heard.at(-1)?.audio).toMatch(/^\/audio\/ta\/x\/.+\.mp3$/);
  });
});
