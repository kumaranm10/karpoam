#!/usr/bin/env node
/**
 * Gemini lesson builder (Google lane, cloud). Runs in .github/workflows/gemini-builder.yml.
 *
 * Mode "new": take the oldest open issue labelled agent:gemini + type:lesson + status:ready that has no
 *   open gemini/ PR, ask Gemini for the lesson JSON, run the lesson gate (up to 3 tries), push a branch
 *   and open a PR (Closes #issue).
 * Mode "fix": for open gemini/ PRs with new review feedback (Claude review "Verdict: changes" or
 *   Kumaran's "changes: …"), regenerate the lesson with that feedback and push to the same branch.
 *
 * Gemini only ever produces lesson DATA for one file path chosen by this script. Nothing it writes is run.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { retryable } from '../agent/review.mjs';
import { pickDesignModels } from '../design/prompt.mjs';
import { checkLessons } from '../lesson-rules.mjs';
import {
  BOT_MARKER,
  branchName,
  buildLessonPrompt,
  errorsFor,
  extractJson,
  lessonPath,
  MAX_FIX_ROUNDS,
  MAX_TRIES,
  parseTarget,
  pendingFeedback,
  prBody,
} from './lesson-prompt.mjs';

const { GEMINI_API_KEY, GH_TOKEN, GITHUB_REPOSITORY: REPO, ISSUE } = process.env;
const OWNER = REPO.split('/')[0];
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
const ghJson = (...args) => JSON.parse(gh(...args));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function ask(models, text) {
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text }] }],
    generationConfig: { temperature: 0.5, responseMimeType: 'application/json' },
  });
  let last;
  for (const model of models.slice(0, 5)) {
    for (const wait of [0, 10_000, 30_000]) {
      if (wait) await sleep(wait);
      try {
        const out = await gemini(`models/${model}:generateContent`, { method: 'POST', body });
        return { model, text: (out.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('') };
      } catch (e) {
        last = e;
        console.log(`${model}: ${e.message.split('\n')[0]}`);
        if (!retryable(e.status)) break;
      }
    }
  }
  throw last;
}

/** Ask, write, check; feed checker errors back. Returns { model, tries } or throws with the last problems. */
async function writeLesson({ models, issue, target, previous = '', feedback = '' }) {
  const rules = readFileSync('AGENTS.md', 'utf8');
  const guide = readFileSync('docs/LESSON_GUIDE.md', 'utf8');
  const example = readFileSync('src/lessons/science/k2/living-and-non-living.json', 'utf8');
  const path = lessonPath(target);
  let problems = [];
  let prev = previous;
  for (let tries = 1; tries <= MAX_TRIES; tries++) {
    const { model, text } = await ask(models, buildLessonPrompt({ rules, guide, example, issue, target, previous: prev, problems, feedback }));
    let lesson;
    try {
      lesson = extractJson(text);
    } catch (e) {
      problems = [`Your answer was not valid JSON (${e.message}). Answer with the JSON object only.`];
      continue;
    }
    lesson.status = 'ready';
    prev = `${JSON.stringify(lesson, null, 2)}\n`;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, prev);
    problems = errorsFor(checkLessons('.').errors, path);
    if (!problems.length) return { model, tries };
    console.log(`Try ${tries}: ${problems.length} problem(s)`);
  }
  throw new Error(`Lesson gate still fails after ${MAX_TRIES} tries:\n${problems.join('\n')}`);
}

const openGeminiPrs = () => ghJson('api', `repos/${REPO}/pulls?state=open&per_page=50`).filter((p) => p.head.ref.startsWith('gemini/'));
const pushUrl = `https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git`;

async function fixMode(models) {
  for (const pr of openGeminiPrs()) {
    const labels = pr.labels.map((l) => l.name);
    if (labels.includes('hold') || labels.includes('needs-kumaran')) continue;
    const comments = ghJson('api', `repos/${REPO}/issues/${pr.number}/comments?per_page=100`);
    const commits = ghJson('api', `repos/${REPO}/pulls/${pr.number}/commits?per_page=100`);
    const since = commits.at(-1)?.commit?.committer?.date ?? pr.created_at;
    const feedback = pendingFeedback(comments, { owner: OWNER, since });
    if (!feedback) continue;
    const rounds = commits.length - 1;
    if (rounds >= MAX_FIX_ROUNDS) {
      gh('api', `repos/${REPO}/issues/${pr.number}/labels`, '-f', 'labels[]=needs-kumaran');
      gh('api', `repos/${REPO}/issues/${pr.number}/comments`, '-f', `body=${BOT_MARKER}\nGemini has reworked this ${rounds} times; handing it to Kumaran.`);
      continue;
    }
    const issueNo = Number((pr.body ?? '').match(/Closes #(\d+)/)?.[1]);
    const issue = ghJson('api', `repos/${REPO}/issues/${issueNo}`);
    const target = parseTarget(issue.title, issue.body ?? '');
    if (!target) continue;
    git('fetch', 'origin', pr.head.ref);
    git('checkout', '-B', pr.head.ref, `origin/${pr.head.ref}`);
    const previous = readFileSync(lessonPath(target), 'utf8');
    try {
      const { model, tries } = await writeLesson({ models, issue, target, previous, feedback });
      git('add', lessonPath(target));
      git('commit', '-m', `lesson: rework #${issueNo} after review (Gemini ${model})`);
      git('push', pushUrl, `HEAD:${pr.head.ref}`);
      gh(
        'api',
        `repos/${REPO}/issues/${pr.number}/comments`,
        '-f',
        `body=${BOT_MARKER}\nReworked by Gemini (${model}, ${tries} ${tries === 1 ? 'try' : 'tries'}) after the latest feedback.`,
      );
    } catch (e) {
      gh('api', `repos/${REPO}/issues/${pr.number}/comments`, '-f', `body=${BOT_MARKER}\n⚠️ Gemini could not rework this: ${String(e.message).slice(0, 600)}`);
    }
    git('checkout', '--detach', 'origin/main');
  }
}

async function newMode(models) {
  const open = openGeminiPrs();
  if (open.length >= 2) return console.log('2 Gemini PRs already open; not starting another.');
  const busy = new Set(open.map((p) => Number((p.body ?? '').match(/Closes #(\d+)/)?.[1])));
  let issues = ghJson('api', `repos/${REPO}/issues?state=open&labels=agent:gemini,type:lesson,status:ready&sort=created&direction=asc&per_page=50`);
  issues = issues.filter((i) => !i.pull_request && !busy.has(i.number) && !i.labels.some((l) => l.name === 'hold'));
  if (ISSUE) issues = issues.filter((i) => i.number === Number(ISSUE));
  for (const issue of issues) {
    const target = parseTarget(issue.title, issue.body ?? '');
    if (!target || target.subject === 'tamil') {
      console.log(`#${issue.number}: skipped (${target ? 'Tamil needs recorded audio' : 'no lesson path/widget in the issue'})`);
      continue;
    }
    git('checkout', '-B', branchName(issue.number, target), 'origin/main');
    try {
      const { model, tries } = await writeLesson({ models, issue, target });
      git('add', lessonPath(target));
      git('commit', '-m', `lesson: ${issue.title.replace(/^G-\d+\s*/, '')} (#${issue.number}, written by Gemini ${model})`);
      git('push', pushUrl, `HEAD:refs/heads/${branchName(issue.number, target)}`);
      const pr = ghJson(
        'api',
        `repos/${REPO}/pulls`,
        '-f',
        `title=lesson: ${issue.title.replace(/^G-\d+\s*/, '')} (Gemini)`,
        '-f',
        `head=${branchName(issue.number, target)}`,
        '-f',
        'base=main',
        '-f',
        `body=${prBody({ issue: issue.number, target, model, tries })}`,
      );
      gh('api', `repos/${REPO}/issues/${pr.number}/labels`, '-f', 'labels[]=type:lesson');
      gh('api', `repos/${REPO}/issues/${issue.number}/comments`, '-f', `body=${BOT_MARKER}\nGemini wrote this lesson in #${pr.number}.`);
      console.log(`Opened #${pr.number} for #${issue.number}`);
    } catch (e) {
      gh(
        'api',
        `repos/${REPO}/issues/${issue.number}/comments`,
        '-f',
        `body=${BOT_MARKER}\n⚠️ Gemini could not write this lesson yet: ${String(e.message).slice(0, 600)}`,
      );
    }
    return; // one new lesson per run keeps the free quota and the review queue small
  }
  console.log('No ready Gemini lesson issues.');
}

async function main() {
  if (!GH_TOKEN) throw new Error('Secret KARPOAM_BOT_TOKEN is missing (needed so PRs start CI).');
  git('config', 'user.name', 'Gemini (Karpoam lane)');
  git('config', 'user.email', 'gemini-lane@users.noreply.github.com');
  git('fetch', 'origin', 'main');
  const models = pickDesignModels((await gemini('models?pageSize=200')).models ?? []);
  await fixMode(models);
  await newMode(models);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
