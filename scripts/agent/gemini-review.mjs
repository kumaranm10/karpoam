#!/usr/bin/env node
/**
 * Gemini review of one PR. Runs in .github/workflows/agent-gate.yml from main (pull_request_target).
 * It never runs PR code: it reads the diff through the GitHub API as data.
 * Sets commit status "agent-review" on the PR head SHA, which the merge decision reads.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { buildPrompt, commentBody, MARKER, MAX_ROUNDS, parseVerdict, pickModels, retryable, SCHEMA } from './review.mjs';

const { GEMINI_API_KEY, PR, SHA, GITHUB_REPOSITORY: REPO } = process.env;
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
const status = (state, description) =>
  gh(
    'api',
    '-X',
    'POST',
    `repos/${REPO}/statuses/${SHA}`,
    '-f',
    `state=${state}`,
    '-f',
    'context=agent-review',
    '-f',
    `description=${description.slice(0, 139)}`,
  );

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Try each model up to 3 times (waits 10 s, 30 s); move to the next model when one stays busy. */
async function generate(models, body) {
  let last;
  for (const model of models.slice(0, 4)) {
    for (const wait of [0, 10_000, 30_000]) {
      if (wait) await sleep(wait);
      try {
        return { model, out: await gemini(`models/${model}:generateContent`, { method: 'POST', body }) };
      } catch (e) {
        last = e;
        console.log(`${model}: ${e.message.split('\n')[0]}`);
        if (!retryable(e.status)) throw e;
      }
    }
  }
  throw last;
}

async function main() {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY secret is missing');
  status('pending', 'Gemini is reviewing');
  const pr = JSON.parse(gh('api', `repos/${REPO}/pulls/${PR}`));
  const files = gh('api', '--paginate', `repos/${REPO}/pulls/${PR}/files`, '--jq', '.[].filename').trim().split('\n').filter(Boolean);
  const diff = gh('pr', 'diff', PR, '--repo', REPO);
  const rules =
    readFileSync('AGENTS.md', 'utf8') + (files.some((f) => f.startsWith('src/lessons/')) ? `\n\n${readFileSync('docs/LESSON_GUIDE.md', 'utf8')}` : '');

  const models = pickModels((await gemini('models?pageSize=200')).models ?? []);
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: buildPrompt({ rules, title: pr.title, body: pr.body, files, diff }) }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.1 },
  });
  const { model, out } = await generate(models, body);
  const text = out.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  const result = parseVerdict(text);

  const previous = JSON.parse(
    gh('api', '--paginate', `repos/${REPO}/issues/${PR}/comments`, '--jq', `[.[] | select(.body | startswith("${MARKER}")) | .body]`),
  );
  const round = previous.filter((b) => b.includes('changes requested')).length + 1;
  gh('api', '-X', 'POST', `repos/${REPO}/issues/${PR}/comments`, '-f', `body=${commentBody(result, { model, round })}`);

  if (result.verdict === 'approve') {
    status('success', `Approved by ${model}`);
  } else {
    status('failure', `Changes requested (round ${round} of ${MAX_ROUNDS})`);
    if (round >= MAX_ROUNDS) gh('api', '-X', 'POST', `repos/${REPO}/issues/${PR}/labels`, '-f', 'labels[]=needs-kumaran');
  }
  console.log(`${result.verdict} (${model}): ${result.summary}`);
}

main().catch((e) => {
  console.error(e.message);
  try {
    status('error', `Review could not run: ${e.message}`);
  } catch {}
  process.exit(1);
});
