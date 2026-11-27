/**
 * Lesson gate. Runs before every build (`npm run check`). Any agent or person adding a lesson must get this to pass.
 * Checks: folder names, required fields, widget exists, widget params make sense, no Hindi/Devanagari characters,
 * audio files exist, and every level/subject is known.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Check every lesson under <root>/src/lessons. Returns problems instead of exiting, so tests can use it. */
export function checkLessons(root) {
  const catalog = JSON.parse(readFileSync(join(root, 'src/catalog.json'), 'utf8'));
  const registry = readFileSync(join(root, 'src/widgets/registry.ts'), 'utf8');
  const WIDGETS = [...registry.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*\(\)\s*=>\s*import\(/gm)].map((m) => m[1]);
  const SUBJ = new Map(catalog.subjects.map((s) => [s.id, s]));
  const LEVELS = new Set(catalog.levels.map((l) => l.id));

  const errors = [],
    warnings = [];
  const err = (f, m) => errors.push(`✗ ${f}: ${m}`);
  const warn = (f, m) => warnings.push(`! ${f}: ${m}`);
  const DEVANAGARI = /[ऀ-ॿ]/;
  const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

  function walkStrings(v, fn, path = '') {
    if (typeof v === 'string') fn(v, path);
    else if (Array.isArray(v))
      v.forEach((x, i) => {
        walkStrings(x, fn, `${path}[${i}]`);
      });
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walkStrings(x, fn, path ? `${path}.${k}` : k);
  }

  const lessonsDir = join(root, 'src/lessons');
  let count = 0;
  const seen = new Set();
  for (const subject of readdirSync(lessonsDir)) {
    const sdir = join(lessonsDir, subject);
    if (!statSync(sdir).isDirectory()) continue;
    if (!SUBJ.has(subject)) {
      err(`src/lessons/${subject}`, `unknown subject folder; add it to src/catalog.json first`);
      continue;
    }
    for (const level of readdirSync(sdir)) {
      const ldir = join(sdir, level);
      if (!statSync(ldir).isDirectory()) continue;
      if (!LEVELS.has(level)) {
        err(`src/lessons/${subject}/${level}`, `unknown level folder; add it to src/catalog.json`);
        continue;
      }
      for (const file of readdirSync(ldir).filter((f) => f.endsWith('.json'))) {
        const f = `src/lessons/${subject}/${level}/${file}`;
        const slug = file.replace(/\.json$/, '');
        count++;
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) err(f, 'file name must be kebab-case, e.g. tens-and-ones.json');
        if (seen.has(`${subject}/${slug}`)) warn(f, 'same slug used in another level of this subject');
        seen.add(`${subject}/${slug}`);
        let L;
        try {
          L = JSON.parse(readFileSync(join(ldir, file), 'utf8'));
        } catch (e) {
          err(f, `invalid JSON: ${e.message}`);
          continue;
        }

        for (const k of ['title', 'icon', 'hook', 'widget']) if (!isStr(L[k])) err(f, `"${k}" is required (text)`);
        if (typeof L.order !== 'number') err(f, '"order" is required (number; lower comes first)');
        if (!['ready', 'draft'].includes(L.status)) err(f, '"status" must be "ready" or "draft"');
        if (!Array.isArray(L.realLife) || L.realLife.length < 1) err(f, '"realLife" needs at least 1 real-world example');
        if (!Array.isArray(L.atHome) || L.atHome.length < 2) err(f, '"atHome" needs at least 2 { thing, ask } rows');
        else
          L.atHome.forEach((a, i) => {
            if (!isStr(a.thing) || !isStr(a.ask)) err(f, `atHome[${i}] needs "thing" and "ask"`);
          });
        if (L.hook && L.hook.length > 140) warn(f, `"hook" is ${L.hook.length} characters; keep it under 140`);
        if (!WIDGETS.includes(L.widget)) err(f, `widget "${L.widget}" does not exist. Known: ${WIDGETS.join(', ')}`);

        walkStrings(L, (s, p) => {
          if (DEVANAGARI.test(s)) err(f, `${p} contains Hindi/Devanagari characters; use Tamil script only`);
        });
        walkStrings(L, (s, p) => {
          if (/^\/audio\/.+\.(mp3|m4a|ogg|wav)$/.test(s) && !existsSync(join(root, 'public', s))) err(f, `${p}: audio file public${s} is missing`);
        });
        if (SUBJ.get(subject).lang === 'ta' && !/[஀-௿]/.test(JSON.stringify(L))) warn(f, 'Tamil lesson has no Tamil script in it');
        if (SUBJ.get(subject).lang !== 'ta')
          walkStrings(L, (s, p) => {
            if (/[஀-௿]/.test(s)) err(f, `${p} has Tamil script; Tamil text belongs only in Tamil lessons`);
          });

        const P = L.params ?? {};
        if (L.widget === 'place-value' && P.target !== undefined && !(P.target >= 21 && P.target <= 99 && P.target % 10 !== 0))
          err(f, 'place-value target must be 21–99 and not end in 0');
        if (L.widget === 'groups')
          for (const k of ['n', 'k'])
            if (P[k] !== undefined && !(Number.isInteger(P[k]) && P[k] >= 2 && P[k] <= 6)) err(f, `groups ${k} must be a whole number 2–6`);
        if (L.widget === 'bonds' && P.whole !== undefined && !(Number.isInteger(P.whole) && P.whole >= 5 && P.whole <= 10))
          err(f, 'bonds whole must be a whole number 5–10');
        if (L.widget === 'sort') {
          const bins = P.bins ?? [],
            items = P.items ?? [];
          if (bins.length < 2 || bins.length > 3) err(f, 'sort needs 2 or 3 bins');
          bins.forEach((b, i) => {
            for (const k of ['id', 'label', 'icon', 'pick']) if (!isStr(b[k])) err(f, `bins[${i}].${k} is required`);
          });
          const ids = new Set(bins.map((b) => b.id)),
            itemIds = new Set();
          items.forEach((it, i) => {
            for (const k of ['id', 'icon', 'name', 'bin', 'why']) if (!isStr(it[k])) err(f, `items[${i}].${k} is required`);
            if (!ids.has(it.bin)) err(f, `items[${i}] bin "${it.bin}" is not one of the bins`);
            if (itemIds.has(it.id)) err(f, `items id "${it.id}" is used twice`);
            itemIds.add(it.id);
          });
          for (const b of bins) if (items.filter((it) => it.bin === b.id).length < 3) err(f, `bin "${b.id}" needs at least 3 items`);
          if (items.length < 8) warn(f, `only ${items.length} items; 10–16 keeps "Try" interesting`);
          (P.story ?? []).forEach((s, i) => {
            if (!itemIds.has(s.item)) err(f, `story[${i}].item "${s.item}" is not an item id`);
            if (!isStr(s.text)) err(f, `story[${i}].text is required`);
            if (s.clues && s.clues.length !== (P.clues ?? []).length) err(f, `story[${i}].clues must have one true/false per clue`);
          });
          if (!isStr(P.ask) || !P.ask.includes('{name}')) err(f, '"ask" is required and must contain {name}');
        }
        if (L.widget === 'listen-pick') {
          const items = P.items ?? [];
          if (!Array.isArray(items) || items.length < 4) err(f, 'listen-pick needs at least 4 items');
          const ids = new Set(),
            names = new Set(),
            icons = new Set();
          (Array.isArray(items) ? items : []).forEach((it, i) => {
            for (const k of ['id', 'icon', 'name']) if (!isStr(it[k])) err(f, `items[${i}].${k} is required`);
            if (ids.has(it.id)) err(f, `items id "${it.id}" is used twice`);
            if (names.has(it.name)) err(f, `items name "${it.name}" is used twice; each sound needs one answer`);
            if (icons.has(it.icon)) err(f, `items icon "${it.icon}" is used twice; each picture needs one answer`);
            ids.add(it.id);
            names.add(it.name);
            icons.add(it.icon);
            if (SUBJ.get(subject).lang === 'ta' && !isStr(it.audio)) warn(f, `items[${i}] has no "audio"; many phones have no Tamil voice`);
          });
          if (P.choices !== undefined && ![3, 4].includes(P.choices)) err(f, 'listen-pick choices must be 3 or 4');
          if (Array.isArray(items) && P.choices > items.length) err(f, 'listen-pick choices cannot be more than the number of items');
          (P.story ?? []).forEach((s, i) => {
            if (!ids.has(s.item)) err(f, `story[${i}].item "${s.item}" is not an item id`);
            if (!isStr(s.text)) err(f, `story[${i}].text is required`);
          });
        }
      }
    }
  }

  return { errors, warnings, count, widgets: WIDGETS };
}
