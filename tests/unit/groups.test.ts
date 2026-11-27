import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mount from '../../src/widgets/groups';
import { btn, click, mountRoot, steps } from './helpers';

const items = (el: Element | null) => el?.querySelectorAll('.it').length ?? 0;
let root: HTMLElement;
beforeEach(() => {
  vi.useFakeTimers();
  root = mountRoot();
  mount(root, { n: 4, k: 3 }, { lang: 'en', title: 'Times tables' });
});
afterEach(() => vi.useRealTimers());

describe('groups', () => {
  it('has See, Try, Real life and Check steps', () => {
    expect(steps(root)).toHaveLength(4);
  });

  it('try: cookies on screen always equal plates × cookies', () => {
    const t = steps(root)[1];
    expect(items(t.querySelector('.groups'))).toBe(6);
    click(t.querySelector('[data-a="g+"]'));
    expect(items(t.querySelector('.groups'))).toBe(9);
    expect(t.querySelector('.times')?.textContent).toBe('3 × 3 = 9');
    click(t.querySelector('[data-a="n+"]'));
    expect(items(t.querySelector('.groups'))).toBe(12);
    expect(t.querySelector('.chal')?.textContent).toContain('Can you make 3 × 2');
  });

  it('try: reaching the challenge celebrates it', () => {
    const t = steps(root)[1];
    click(t.querySelector('[data-a="g+"]'));
    click(t.querySelector('[data-a="n-"]'));
    expect(t.querySelector('.chal')?.textContent).toContain('Yes! 3 plates of 2 make 6');
  });

  it('real life: every table 1–10 draws the right number of things', () => {
    const r = steps(root)[2];
    const tiles = [...r.querySelectorAll<HTMLButtonElement>('.tile')];
    expect(tiles).toHaveLength(10);
    tiles.forEach((tile, i) => {
      click(tile);
      const n = i + 1;
      expect(items(r.querySelector('.groups'))).toBe(n);
      click(btn(r, 'one more'));
      click(btn(r, 'one more'));
      expect(items(r.querySelector('.groups'))).toBe(3 * n);
      expect(r.querySelector('.times')?.textContent).toBe(`3 × ${n} = ${3 * n}`);
      expect(r.querySelectorAll('tbody tr')).toHaveLength(10);
    });
  });

  it('check: every question has exactly one right answer (200 questions)', () => {
    const c = steps(root)[3];
    for (let q = 0; q < 200; q++) {
      click(btn(c, 'Next question'));
      const text = c.querySelector('.qtext')!.textContent!;
      const opts = [...c.querySelectorAll<HTMLElement>('.qopt')];
      expect(opts).toHaveLength(3);
      if (text.startsWith('Which picture')) {
        const [a, b] = text.match(/\d+/g)!.map(Number);
        const matches = opts.filter((o) => {
          const grps = [...o.querySelectorAll('.grp')];
          return grps.length === a && grps.every((g) => g.querySelectorAll('.it').length === b);
        });
        expect(matches).toHaveLength(1);
      } else {
        const pic = [...c.children].find((x) => x.classList.contains('groups'))!;
        const total = items(pic);
        const values = opts.map((o) => Number(o.firstChild!.textContent));
        expect(values.filter((v) => v === total)).toHaveLength(1);
      }
    }
  });

  it('story: the child taps 3 plates and finishes', () => {
    const s = steps(root)[0];
    click(btn(s, 'Start'));
    for (let i = 0; i < 5; i++) click(btn(s, 'Next'));
    const plates = () => [...s.querySelectorAll<HTMLButtonElement>('button.plate')];
    expect(plates()).toHaveLength(3);
    for (let i = 0; i < 3; i++) click(plates()[i] ?? s.querySelector('.plate'));
    expect(s.querySelector('.say')?.textContent).toContain('You did it! 3 plates of 4 make 12');
    expect(s.querySelector('.times')?.textContent).toBe('3 × 4 = 12');
  });
});
