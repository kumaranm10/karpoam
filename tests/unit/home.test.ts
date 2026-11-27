import { describe, expect, it } from 'vitest';
import type { Lesson } from '../../src/config';
import { HOME_MAX, HOME_SHOW, homeLessons } from '../../src/lib/home';

const LEVELS = ['k2', 'p1', 'p2'];

/** Generated lesson data (no lesson files): `n` ready lessons for one subject, spread over the levels. */
function make(subject: string, n: number): Lesson[] {
  return Array.from({ length: n }, (_, i) => ({
    slug: `${subject}-${i}`,
    title: `${subject} ${i}`,
    subject,
    level: LEVELS[i % LEVELS.length],
    order: 10 * (Math.floor(i / LEVELS.length) + 1),
    icon: '🍪',
    hook: 'A lesson.',
    realLife: ['cookies'],
    widget: 'sort',
    atHome: [],
    status: 'ready' as const,
  }));
}
const byOrder = (ls: Lesson[]) => [...ls].sort((a, b) => a.order - b.order);

describe('homeLessons', () => {
  it('changes nothing when every subject has 9 or fewer lessons', () => {
    for (let m = 0; m <= HOME_MAX; m++) {
      for (let s = 0; s <= HOME_MAX; s++) {
        const all = byOrder([...make('maths', m), ...make('science', s)]);
        const home = homeLessons(all, LEVELS);
        expect(home.lessons).toEqual(all);
        expect(home.seeAll).toEqual([]);
      }
    }
  });

  it('shows the newest 6 and a See all link when a subject has more than 9', () => {
    for (let m = HOME_MAX + 1; m <= 40; m++) {
      const maths = make('maths', m);
      const science = make('science', 3);
      const all = byOrder([...maths, ...science]);
      const home = homeLessons(all, LEVELS);
      const shownMaths = home.lessons.filter((l) => l.subject === 'maths');
      expect(shownMaths).toHaveLength(HOME_SHOW);
      expect(home.seeAll).toEqual([{ subject: 'maths', total: m }]);
      // every shown maths lesson is at least as new as every hidden one
      const hidden = maths.filter((l) => !shownMaths.includes(l));
      const key = (l: Lesson) => l.order * 10 + LEVELS.indexOf(l.level);
      expect(Math.min(...shownMaths.map(key))).toBeGreaterThan(Math.max(...hidden.map(key)));
      // small subjects are untouched, and the original order is kept
      expect(home.lessons.filter((l) => l.subject === 'science')).toEqual(science);
      expect(home.lessons).toEqual(all.filter((l) => home.lessons.includes(l)));
    }
  });

  it('trims each large subject on its own', () => {
    const home = homeLessons([...make('maths', 12), ...make('english', 10), ...make('science', 9)], LEVELS);
    expect(home.seeAll).toEqual([
      { subject: 'maths', total: 12 },
      { subject: 'english', total: 10 },
    ]);
    expect(home.lessons).toHaveLength(HOME_SHOW * 2 + 9);
  });

  it('breaks an order tie by the later level', () => {
    const ls = make('maths', 10).map((l) => ({ ...l, order: 10 }));
    const shown = homeLessons(ls, LEVELS).lessons;
    expect(shown.map((l) => l.level).sort()).toEqual(['p1', 'p1', 'p1', 'p2', 'p2', 'p2']);
  });
});
