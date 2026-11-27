import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import lesson from '../../src/lessons/science/k2/living-and-non-living.json';
import mount from '../../src/widgets/sort';
import { btn, click, mountRoot, steps } from './helpers';

const P = lesson.params;
const byName = new Map(P.items.map((i) => [i.name, i]));
let root: HTMLElement;
beforeEach(() => {
  vi.useFakeTimers();
  root = mountRoot();
  mount(root, P, { lang: 'en', title: lesson.title });
});
afterEach(() => vi.useRealTimers());

describe('sort', () => {
  it('story has intro + examples + your turn', () => {
    const see = steps(root)[0];
    click(btn(see, 'Start'));
    expect(see.querySelectorAll('.dots span')).toHaveLength(P.story.length + 2);
    click(btn(see, 'Next'));
    expect(see.querySelector('.so-name')?.textContent).toBe('cat');
    expect(see.querySelectorAll('.so-clue.yes')).toHaveLength(4);
  });

  it('try: sorting every picture correctly finishes the game', async () => {
    const t = steps(root)[1];
    for (let i = 0; i < P.items.length; i++) {
      const name = t.querySelector('.so-name')!.textContent!;
      const item = byName.get(name)!;
      click(t.querySelector(`button[data-bin="${item.bin}"]`));
      await vi.advanceTimersByTimeAsync(20000);
    }
    expect(t.querySelector('.so-progress')?.textContent).toBe(`${P.items.length} of ${P.items.length} sorted`);
    expect(t.querySelector('.say')?.textContent).toContain('All sorted');
    expect(t.querySelectorAll('.so-got span')).toHaveLength(P.items.length);
  });

  it('try: a wrong basket does not count', async () => {
    const t = steps(root)[1];
    const item = byName.get(t.querySelector('.so-name')!.textContent!)!;
    const wrong = P.bins.find((b) => b.id !== item.bin)!;
    click(t.querySelector(`button[data-bin="${wrong.id}"]`));
    expect(t.querySelector(`button[data-bin="${wrong.id}"]`)?.classList.contains('bad')).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.querySelector('.so-progress')?.textContent).toBe(`0 of ${P.items.length} sorted`);
    click(btn(t, 'Play again'));
    expect(t.querySelector('.so-progress')?.textContent).toBe(`0 of ${P.items.length} sorted`);
  });

  it('check: exactly one picture fits each question (200 questions)', () => {
    const c = steps(root)[2];
    for (let q = 0; q < 200; q++) {
      click(btn(c, 'Next question'));
      const bin = P.bins.find((b) => b.pick === c.querySelector('.qtext')!.textContent)!;
      expect(bin).toBeTruthy();
      const opts = [...c.querySelectorAll<HTMLElement>('.qopt')];
      expect(opts.filter((o) => byName.get(o.getAttribute('aria-label')!)!.bin === bin.id)).toHaveLength(1);
    }
  });

  it('check: answers are scored', () => {
    const c = steps(root)[2];
    const bin = P.bins.find((b) => b.pick === c.querySelector('.qtext')!.textContent)!;
    const right = [...c.querySelectorAll<HTMLElement>('.qopt')].find((o) => byName.get(o.getAttribute('aria-label')!)!.bin === bin.id);
    click(right);
    expect(c.querySelector('.score')?.textContent).toBe('1 of 1 right');
    expect(c.querySelector('.qfb')?.className).toBe('qfb ok');
  });
});
