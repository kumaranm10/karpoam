#!/usr/bin/env node
/**
 * Gemini design lane: reads a design issue, looks at screenshots of the built site (made by
 * scripts/design/screenshots.mjs) and posts a design proposal as an issue comment.
 * Runs in .github/workflows/gemini-design.yml. It only reads the repo and writes one comment.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { retryable } from '../agent/review.mjs';
import { buildDesignPrompt, designComment, pickDesignModels } from './prompt.mjs';

const { GEMINI_API_KEY, ISSUE, GITHUB_REPOSITORY: REPO, SHOTS = 'shots' } = process.env;
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SOURCES = [
  'src/styles/global.css',
  'src/styles/site.css',
  'src/pages/index.astro',
  'src/components/Header.astro',
  'src/components/Footer.astro',
  'src/components/LessonCard.astro',
];
const SHOT_NAMES = ['home-phone-light.png', 'home-phone-dark.png', 'home-desktop-light.png', 'home-desktop-dark.png'];

async function gemini(path, init = {}) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const err = new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** Pro models may be refused on a free key (403/404/400): move on to the next model instead of failing. */
async function generate(models, body) {
  let last;
  for (const model of models.slice(0, 5)) {
    for (const wait of [0, 10_000, 30_000]) {
      if (wait) await sleep(wait);
      try {
        return { model, out: await gemini(`models/${model}:generateContent`, { method: 'POST', body }) };
      } catch (e) {
        last = e;
        console.log(`${model}: ${e.message.split('\n')[0]}`);
        if (!retryable(e.status)) break;
      }
    }
  }
  throw last;
}

async function main() {
  const issue = JSON.parse(gh('api', `repos/${REPO}/issues/${ISSUE}`));
  const rules = readFileSync('AGENTS.md', 'utf8');
  const sources = SOURCES.map((path) => ({ path, text: readFileSync(path, 'utf8') }));
  const text = buildDesignPrompt({ rules, title: issue.title, body: issue.body ?? '', sources });
  const images = SHOT_NAMES.map((n) => ({ inline_data: { mime_type: 'image/png', data: readFileSync(join(SHOTS, n)).toString('base64') } }));
  const body = JSON.stringify({ contents: [{ role: 'user', parts: [{ text }, ...images] }], generationConfig: { temperature: 0.4 } });

  const models = pickDesignModels((await gemini('models?pageSize=200')).models ?? []);
  const { model, out } = await generate(models, body);
  const answer = (out.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  if (!answer.trim()) throw new Error('Gemini returned an empty proposal');
  gh('api', `repos/${REPO}/issues/${ISSUE}/comments`, '-f', `body=${designComment(answer, { model })}`);
  console.log(`Posted design proposal from ${model}`);
}

main().catch((e) => {
  console.error(e);
  try {
    gh('api', `repos/${REPO}/issues/${ISSUE}/comments`, '-f', `body=⚠️ Gemini design run failed: ${String(e.message).slice(0, 300)}`);
  } catch {}
  process.exit(1);
});
