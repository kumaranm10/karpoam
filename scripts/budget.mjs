#!/usr/bin/env node
/** Speed budget: fails if any page ships too much. Runs after `npm run build`. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');
const LIMITS = { html: 60 * 1024, jsPerPage: 100 * 1024, cssPerPage: 60 * 1024, jsTotal: 200 * 1024 };
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const files = walk(dist);
const size = (p) => statSync(join(dist, p)).size;
const problems = [];
let worst = { js: 0, css: 0, page: '' };

for (const f of files.filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(f, 'utf8');
  const page = `/${relative(dist, f)}`;
  if (statSync(f).size > LIMITS.html) problems.push(`${page}: HTML ${statSync(f).size} B > ${LIMITS.html}`);
  const js = [...html.matchAll(/<script[^>]+src="\/([^"]+\.js)"/g), ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="\/([^"]+)"/g)].map((m) => m[1]);
  const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\/([^"]+\.css)"/g)].map((m) => m[1]);
  const jsB = [...new Set(js)].reduce((a, p) => a + size(p), 0);
  const cssB = [...new Set(css)].reduce((a, p) => a + size(p), 0);
  if (jsB > LIMITS.jsPerPage) problems.push(`${page}: JS ${jsB} B > ${LIMITS.jsPerPage}`);
  if (cssB > LIMITS.cssPerPage) problems.push(`${page}: CSS ${cssB} B > ${LIMITS.cssPerPage}`);
  if (jsB + cssB > worst.js + worst.css) worst = { js: jsB, css: cssB, page };
}
const jsTotal = files.filter((f) => f.endsWith('.js')).reduce((a, f) => a + statSync(f).size, 0);
if (jsTotal > LIMITS.jsTotal) problems.push(`all JS together ${jsTotal} B > ${LIMITS.jsTotal}`);

console.log(
  `Heaviest page ${worst.page}: JS ${(worst.js / 1024).toFixed(1)} KB, CSS ${(worst.css / 1024).toFixed(1)} KB. All JS: ${(jsTotal / 1024).toFixed(1)} KB.`,
);
if (problems.length) {
  for (const p of problems) console.error(`✗ ${p}`);
  process.exit(1);
}
console.log('✓ Speed budget OK');
