import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');
const catalog = JSON.parse(readFileSync(join(root, 'src/catalog.json'), 'utf8'));

/** Every lesson URL, read from src/lessons so new lessons are tested automatically. */
export const lessonUrls: string[] = [];
for (const subject of readdirSync(join(root, 'src/lessons'))) {
  for (const level of readdirSync(join(root, 'src/lessons', subject))) {
    for (const f of readdirSync(join(root, 'src/lessons', subject, level))) {
      if (f.endsWith('.json')) lessonUrls.push(`/${subject}/${level}/${f.replace('.json', '')}/`);
    }
  }
}
const open = catalog.levels.filter((l: { open: boolean }) => l.open);
export const listUrls: string[] = [
  '/',
  '/parents/',
  '/about/',
  '/privacy/',
  ...catalog.subjects.map((s: { id: string }) => `/${s.id}/`),
  ...catalog.subjects.flatMap((s: { id: string }) => open.map((l: { id: string }) => `/${s.id}/${l.id}/`)),
];
