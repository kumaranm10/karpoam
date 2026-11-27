#!/usr/bin/env node
/** Lesson gate CLI. Runs before every build (`npm run check`). Rules live in lesson-rules.mjs. */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLessons } from './lesson-rules.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { errors, warnings, count, widgets } = checkLessons(root);
for (const w of warnings) console.log(w);
if (errors.length) {
  for (const e of errors) console.error(e);
  console.error(`\n${errors.length} problem(s) in ${count} lesson(s).`);
  process.exit(1);
}
console.log(`✓ ${count} lesson(s) OK. Widgets: ${widgets.join(', ')}`);
