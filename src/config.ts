import site from './site.json';

export const SITE = site;

import catalog from './catalog.json';

/** Levels and subjects live in src/catalog.json. Set a level's "open" to true when it has lessons. */
export interface Level {
  id: string;
  name: string;
  long: string;
  age: string;
  open: boolean;
}
export interface Subject {
  id: string;
  name: string;
  tamil: string;
  icon: string;
  lang: 'en' | 'ta';
  blurb: string;
}
export const LEVELS = catalog.levels as Level[];
export const SUBJECTS = catalog.subjects as Subject[];

export type SubjectId = string;
export type LevelId = string;

export interface AtHome {
  thing: string;
  ask: string;
}
export interface Lesson {
  slug: string;
  title: string;
  titleTamil?: string;
  subject: SubjectId;
  level: LevelId;
  order: number;
  icon: string;
  hook: string;
  realLife: string[];
  widget: string;
  params?: Record<string, unknown>;
  atHome: AtHome[];
  tips?: string[];
  status: 'ready' | 'draft';
}

const files = import.meta.glob<{ default: Omit<Lesson, 'slug' | 'subject' | 'level'> }>('./lessons/*/*/*.json', { eager: true });

/** All lessons, read from src/lessons/<subject>/<level>/<slug>.json. Subject, level and slug come from the path. */
export const LESSONS: Lesson[] = Object.entries(files)
  .map(([path, mod]) => {
    const [, , subject, level, file] = path.split('/');
    return { ...mod.default, subject, level, slug: file.replace(/\.json$/, '') } as Lesson;
  })
  .sort((a, b) => a.order - b.order);

export const readyLessons = () => LESSONS.filter((l) => l.status === 'ready');
export const subjectById = (id: string) => SUBJECTS.find((s) => s.id === id)!;
export const levelById = (id: string) => LEVELS.find((l) => l.id === id)!;
export const lessonUrl = (l: Pick<Lesson, 'subject' | 'level' | 'slug'>) => `/${l.subject}/${l.level}/${l.slug}/`;
