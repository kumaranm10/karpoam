import { describe, expect, it } from 'vitest';
import { esc, h, plural, rnd, shuffle, step, uniq } from '../../src/lib/dom';

describe('h()', () => {
  it('sets class, attributes and html, skipping undefined/false', () => {
    const el = h('button', { class: 'btn go', type: 'button', disabled: true, hidden: false, title: undefined }, '<b>Hi</b>');
    expect(el.className).toBe('btn go');
    expect(el.getAttribute('type')).toBe('button');
    expect(el.hasAttribute('disabled')).toBe(true);
    expect(el.hasAttribute('hidden')).toBe(false);
    expect(el.hasAttribute('title')).toBe(false);
    expect(el.innerHTML).toBe('<b>Hi</b>');
  });
});

describe('step()', () => {
  it('appends a numbered, labelled section', () => {
    const root = document.createElement('div');
    const s = step(root, 2, 'Try: make it');
    expect(root.firstElementChild).toBe(s);
    expect(s.getAttribute('aria-label')).toBe('Try: make it');
    expect(s.querySelector('.step-num')?.textContent).toBe('2');
    expect(s.querySelector('.step-title')?.textContent).toBe('Try: make it');
  });
});

describe('number helpers', () => {
  it('rnd stays inside the range, inclusive', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rnd(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });
  it('shuffle keeps exactly the same items', () => {
    const a = [1, 2, 3, 4, 5, 6, 7];
    expect([...shuffle([...a])].sort()).toEqual(a);
  });
  it('uniq removes repeats and keeps order', () => {
    expect(uniq([3, 1, 3, 2, 1])).toEqual([3, 1, 2]);
  });
  it('plural uses singular only for 1', () => {
    expect(plural(1, 'ten')).toBe('1 ten');
    expect(plural(0, 'ten')).toBe('0 tens');
    expect(plural(2, 'child', 'children')).toBe('2 children');
  });
  it('esc makes text safe for innerHTML', () => {
    expect(esc(`<a href="x">Tom's & co</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom&#39;s &amp; co&lt;/a&gt;');
  });
});
