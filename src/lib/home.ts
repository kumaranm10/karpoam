import type { Lesson } from '../config';

/** A subject has more lessons than fit on the home page; link to its page. */
export interface SeeAll {
  subject: string;
  total: number;
}

export interface HomeLessons {
  lessons: Lesson[];
  seeAll: SeeAll[];
}

/** A subject with more than this many ready lessons is trimmed on the home page. */
export const HOME_MAX = 9;
/** How many lessons such a subject shows. */
export const HOME_SHOW = 6;

/**
 * Pick the lessons for the home page.
 * Subjects with ≤ HOME_MAX lessons show all of them. Larger subjects show their newest HOME_SHOW
 * (highest `order`, later level first on a tie) and get a "See all" entry.
 * Lessons keep the order they came in, so a site with only small subjects looks exactly as before.
 * @param levels level ids from youngest to oldest (catalog order), used to break ties.
 */
export function homeLessons(lessons: Lesson[], levels: string[]): HomeLessons {
  const bySubject = new Map<string, Lesson[]>();
  for (const l of lessons) {
    const list = bySubject.get(l.subject) ?? [];
    list.push(l);
    bySubject.set(l.subject, list);
  }
  const keep = new Set<Lesson>();
  const seeAll: SeeAll[] = [];
  for (const [subject, list] of bySubject) {
    if (list.length <= HOME_MAX) {
      for (const l of list) keep.add(l);
      continue;
    }
    const newest = [...list].sort((a, b) => b.order - a.order || levels.indexOf(b.level) - levels.indexOf(a.level));
    for (const l of newest.slice(0, HOME_SHOW)) keep.add(l);
    seeAll.push({ subject, total: list.length });
  }
  return { lessons: lessons.filter((l) => keep.has(l)), seeAll };
}
