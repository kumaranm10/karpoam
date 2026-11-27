import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mount, { bondsOf, makeQuestion, threeOptions } from '../../src/widgets/bonds';
import { btn, click, mountRoot, steps } from './helpers';

const sweets = (el: Element | null | undefined) => el?.querySelectorAll('.bo-sweet').length ?? 0;
const hands = (el: Element) => [...el.querySelectorAll<HTMLElement>('.bo-hand')];
let root: HTMLElement;
function setup(params: Record<string, unknown> = { whole: 7 }) {
  root = mountRoot();
  mount(root, params, { lang: 'en', title: 'Number bonds' });
}
beforeEach(() => {
  vi.useFakeTimers();
  setup();
});
afterEach(() => vi.useRealTimers());

describe('bond helpers', () => {
  it('bondsOf lists every split once, smaller part first', () => {
    expect(bondsOf(7)).toEqual([
      [0, 7],
      [1, 6],
      [2, 5],
      [3, 4],
    ]);
    expect(bondsOf(10)).toHaveLength(6);
    for (let w = 2; w <= 10; w++) for (const [a, b] of bondsOf(w)) expect(a + b).toBe(w);
  });
  it('threeOptions holds the answer exactly once among 3 different numbers 0–10', () => {
    for (let q = 0; q < 200; q++) {
      const ans = q % 11;
      const o = threeOptions(ans, [ans + 1, ans - 1, ans, ans + 2, 11, -1]);
      expect(o).toHaveLength(3);
      expect(o.filter((v) => v === ans)).toHaveLength(1);
      expect(new Set(o).size).toBe(3);
      for (const v of o) expect(v >= 0 && v <= 10).toBe(true);
    }
  });
  it('makeQuestion keeps every number within bonds to 10 (200 questions)', () => {
    for (let q = 0; q < 200; q++) {
      const Q = makeQuestion();
      expect(Q.opts).toHaveLength(3);
      if (Q.type === 'part') {
        expect(Q.whole).toBeLessThanOrEqual(10);
        expect(Q.a).toBeGreaterThanOrEqual(1);
        expect(Q.a).toBeLessThan(Q.whole);
        expect(Q.opts.filter((v) => v === Q.whole - Q.a)).toHaveLength(1);
      } else {
        expect(Q.a + Q.b).toBeLessThanOrEqual(10);
        expect(Q.opts.filter((v) => v === Q.a + Q.b)).toHaveLength(1);
      }
    }
    expect(makeQuestion({ whole: 7, a: 3 })).toMatchObject({ type: 'part', whole: 7, a: 3 });
  });
});

describe('bonds', () => {
  it('has See, Try and Check steps', () => {
    expect(steps(root)).toHaveLength(3);
  });

  it('story: sweets drawn always match the numbers in the bond', () => {
    const s = steps(root)[0];
    expect(sweets(s)).toBe(7);
    click(btn(s, 'Start'));
    click(btn(s, 'Next'));
    const [l, r] = hands(s);
    expect([sweets(l), sweets(r)]).toEqual([3, 4]);
    click(btn(s, 'Next'));
    expect(s.querySelector('.say')?.textContent).toBe('3 and 4 make 7.');
    expect(s.querySelector('.bo-w')?.textContent).toBe('7');
    expect(s.querySelector('.bo-eq')?.textContent).toBe('3 + 4 = 7');
    click(btn(s, 'Next'));
    const [l2, r2] = hands(s);
    expect([sweets(l2), sweets(r2)]).toEqual([2, 5]);
    expect(s.querySelector('.bo-eq')?.textContent).toBe('2 + 5 = 7');
    click(btn(s, 'Next'));
    expect(s.querySelector('.bo-bond.bo-hl')).not.toBeNull();
    click(btn(s, 'Next'));
    expect(sweets(s)).toBe(7);
    click(btn(s, 'Start again'));
    expect(s.querySelector('.dots span.on')).toBe(s.querySelector('.dots span'));
  });

  it('whole is kept to 5–10', () => {
    setup({ whole: 30 });
    expect(sweets(steps(root)[0])).toBe(10);
    setup({});
    expect(sweets(steps(root)[0])).toBe(7);
    setup({ whole: 2 });
    expect(sweets(steps(root)[0])).toBe(5);
  });

  it('try: tapping a sweet moves it; the whole never changes', () => {
    const t = steps(root)[1];
    const count = () => hands(t).map(sweets);
    expect(count()).toEqual([7, 0]);
    click(t.querySelector('.bo-hand[data-side="0"] .bo-tap'));
    expect(count()).toEqual([6, 1]);
    expect(t.querySelector('.say')?.textContent).toBe('6 and 1 make 7.');
    expect(t.querySelector('.bo-eq')?.textContent).toBe('6 + 1 = 7');
    click(t.querySelector('.bo-hand[data-side="1"] .bo-tap'));
    expect(count()).toEqual([7, 0]);
    for (let i = 0; i < 7; i++) {
      click(t.querySelector('.bo-hand[data-side="0"] .bo-tap'));
      const [a, b] = count();
      expect(a + b).toBe(7);
      expect(t.querySelector('.bo-a')?.textContent).toBe(String(a));
      expect(t.querySelector('.bo-b')?.textContent).toBe(String(b));
    }
    expect(count()).toEqual([0, 7]);
    expect(t.querySelectorAll('.bo-chip.bo-got')).toHaveLength(4);
    expect(t.querySelector('.chal')?.textContent).toContain('every way to make 7');
    expect(t.querySelector('.chal')?.classList.contains('won')).toBe(true);
  });

  it('try: the stepper changes the whole and resets the hands', () => {
    const t = steps(root)[1];
    click(t.querySelector('[data-a="w+"]'));
    expect(hands(t).map(sweets)).toEqual([8, 0]);
    expect(t.querySelectorAll('.bo-chip')).toHaveLength(5);
    expect(t.querySelector('.chal')?.textContent).toContain('1 of 5 found');
    for (let i = 0; i < 10; i++) click(t.querySelector('[data-a="w+"]'));
    expect(t.querySelector('[data-v="w"]')?.textContent).toBe('10');
    expect(t.querySelector<HTMLButtonElement>('[data-a="w+"]')?.disabled).toBe(true);
    for (let i = 0; i < 12; i++) click(t.querySelector('[data-a="w-"]'));
    expect(t.querySelector('[data-v="w"]')?.textContent).toBe('2');
    expect(hands(t).map(sweets)).toEqual([2, 0]);
  });

  it('check: the first question is the story bond with a closed hand', () => {
    const c = steps(root)[2];
    expect(c.querySelector('.qtext')?.textContent).toBe('7 = 3 + ?');
    expect(c.querySelector('.bo-closed')).not.toBeNull();
    expect(sweets(c.querySelector('.bo-hands'))).toBe(3);
  });

  it('check: every question has exactly one right answer, read from the picture (200 questions)', () => {
    const c = steps(root)[2];
    for (let q = 0; q < 200; q++) {
      click(btn(c, 'Next question'));
      const pic = c.querySelector('.bo-hands')!;
      const opts = [...c.querySelectorAll<HTMLButtonElement>('.qopt')];
      expect(opts).toHaveLength(3);
      const values = opts.map((o) => Number(o.firstChild!.textContent));
      const nums = c.querySelector('.qtext')!.textContent!.match(/\d+/g)!.map(Number);
      let want: number;
      if (c.querySelector('.bo-closed')) {
        const whole = Number(c.querySelector('.bo-w')!.textContent);
        const seen = sweets(pic);
        expect(nums).toEqual([whole, seen]);
        want = whole - seen;
      } else {
        const [l, r] = hands(pic).map(sweets);
        expect(nums).toEqual([l, r]);
        want = l + r;
      }
      expect(want).toBeGreaterThanOrEqual(0);
      expect(values.filter((v) => v === want)).toHaveLength(1);
      // Answer (right or wrong); the closed hand opens and shows the real sweets.
      click(opts[q % 3]);
      expect(sweets(pic)).toBe(Number(c.querySelector('.bo-w')!.textContent));
      expect(c.querySelector('.qfb')?.className).toMatch(/qfb (ok|no)/);
      expect(c.querySelector('.qfb')?.textContent).toMatch(/^(🎉 Yes!|Not quite\.)/);
    }
    expect(c.querySelector('.score')?.textContent).toMatch(/of 200 right/);
  });

  it('check: a wrong answer explains the bond', () => {
    const c = steps(root)[2];
    const wrong = [...c.querySelectorAll<HTMLButtonElement>('.qopt')].find((o) => o.firstChild!.textContent !== '4')!;
    click(wrong);
    expect(c.querySelector('.qfb')?.textContent).toBe('Not quite. 3 and 4 make 7. 4 were hidden.');
    expect(c.querySelector('.score')?.textContent).toBe('0 of 1 right');
    expect(c.querySelector('.qopt.right')?.textContent).toBe('4✓');
  });
});
