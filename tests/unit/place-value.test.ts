import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mount from '../../src/widgets/place-value';
import { btn, click, mountRoot, steps } from './helpers';

const sticks = (el: Element) => el.querySelectorAll('.stk').length;
let root: HTMLElement;
beforeEach(() => {
  vi.useFakeTimers();
  root = mountRoot();
  mount(root, { target: 74 }, { lang: 'en', title: 'Tens and ones' });
});
afterEach(() => vi.useRealTimers());

describe('place-value: layout', () => {
  it('has See, Try and Check steps', () => {
    expect(steps(root).map((s) => s.getAttribute('aria-label'))).toEqual(['See: bundles of ten', 'Try: make the number', 'Check: picture quiz']);
  });
  it('story opens with exactly one stick', () => {
    expect(sticks(steps(root)[0].querySelector('.scene')!)).toBe(1);
  });
  it('falls back to 74 for an invalid target', () => {
    const r = mountRoot();
    mount(r, { target: 70 }, { lang: 'en', title: '' });
    expect(steps(r)[0].querySelector('.say')?.textContent).toContain('one');
  });
});

describe('place-value: try', () => {
  const tryStep = () => steps(root)[1];
  const press = (a: string, n = 1) => {
    for (let i = 0; i < n; i++) click(tryStep().querySelector(`[data-a="${a}"]`));
  };
  it('the picture always has 10 × bundles + sticks', () => {
    press('t+', 2);
    press('o+', 3);
    expect(sticks(tryStep().querySelector('.scene')!)).toBe(23);
    expect(tryStep().querySelector('.chal')?.textContent).toContain('Yes! 2 tens and 3 ones make 23');
  });
  it('opening a bundle keeps the same number', () => {
    press('t+', 2);
    press('o+', 3);
    click(btn(tryStep(), 'Open a bundle'));
    expect(tryStep().querySelector('[data-v="t"]')?.textContent).toBe('1');
    expect(tryStep().querySelector('[data-v="o"]')?.textContent).toBe('13');
    expect(sticks(tryStep().querySelector('.scene')!)).toBe(23);
    click(btn(tryStep(), 'Band 10 sticks'));
    expect(tryStep().querySelector('[data-v="t"]')?.textContent).toBe('2');
  });
  it('disables buttons that would break the rules', () => {
    expect(btn(tryStep(), 'Open a bundle')?.disabled).toBe(true);
    expect(btn(tryStep(), 'Band 10 sticks')?.disabled).toBe(true);
    expect((tryStep().querySelector('[data-a="t-"]') as HTMLButtonElement).disabled).toBe(true);
  });
  it('“make 74 with 6 bundles” needs the opened bundle', () => {
    for (let i = 0; i < 2; i++) click(btn(tryStep(), 'New challenge'));
    expect(tryStep().querySelector('.chal')?.textContent).toContain('74 with only 6 bundles');
    press('t+', 7);
    press('o+', 4);
    expect(tryStep().querySelector('.chal')?.textContent).not.toContain('Yes!');
    click(btn(tryStep(), 'Open a bundle'));
    expect(tryStep().querySelector('.chal')?.textContent).toContain('Yes! 6 tens and 14 ones make 74');
  });
});

describe('place-value: check quiz', () => {
  const check = () => steps(root)[2];
  it('first question is the school question about 74', () => {
    expect(check().querySelector('.qtext')?.textContent).toBe('Which one makes 74?');
    const labels = [...check().querySelectorAll('.qopt')].map((b) => b.getAttribute('aria-label')).sort();
    expect(labels).toEqual(['6 tens and 14 ones', '6 tens and 4 ones', '7 tens and 10 ones']);
    click(check().querySelector('[aria-label="6 tens and 14 ones"]'));
    expect(check().querySelector('.qfb')?.className).toBe('qfb ok');
    expect(check().querySelector('.score')?.textContent).toBe('1 of 1 right');
  });
  it('a wrong answer is explained, not counted', () => {
    click(check().querySelector('[aria-label="7 tens and 10 ones"]'));
    expect(check().querySelector('.qfb')?.className).toBe('qfb no');
    expect(check().querySelector('.qfb')?.textContent).toContain('6 tens and 14 ones');
    expect(check().querySelector('.score')?.textContent).toBe('0 of 1 right');
  });
  it('every generated question has exactly one answer that matches its picture (200 questions)', () => {
    for (let n = 0; n < 200; n++) {
      click(btn(check(), 'Next question'));
      const q = check().querySelector('.qtext')!.textContent!;
      const opts = [...check().querySelectorAll<HTMLElement>('.qopt')];
      expect(opts.length).toBe(3);
      if (q.startsWith('Which one makes')) {
        const target = Number(q.match(/\d+/)![0]);
        expect(opts.filter((o) => sticks(o) === target)).toHaveLength(1);
      } else {
        const pic = [...check().children].find((c) => !c.classList.contains('qopts') && (c.querySelector('.stk') || c.querySelector('.money')))!;
        const value = q === 'How many sticks?' ? sticks(pic) : pic.querySelectorAll('.note10').length * 10 + pic.querySelectorAll('.coin1').length;
        const values = opts.map((o) => Number(o.firstChild!.textContent!.replace('$', '')));
        expect(values.filter((v) => v === value)).toHaveLength(1);
        expect(new Set(values).size).toBe(3);
      }
    }
  });
});

describe('place-value: story', () => {
  it('last step lets the child open a bundle and the total stays 74', () => {
    const see = steps(root)[0];
    click(btn(see, 'Start'));
    for (let i = 0; i < 6; i++) click(btn(see, 'Next'));
    expect(see.querySelector('.say')?.textContent).toContain('Tap a bundle');
    expect(sticks(see.querySelector('.scene')!)).toBe(74);
    click(see.querySelector('button.bundle'));
    expect(see.querySelector('.say')?.textContent).toContain('5 tens and 24 ones. Still 74!');
    expect(sticks(see.querySelector('.scene')!)).toBe(74);
  });
});
