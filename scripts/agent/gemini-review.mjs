#!/usr/bin/env node
/**
 * Gemini review of one PR. Runs in .github/workflows/agent-gate.yml from main (pull_request_target).
 * It never runs PR code: it reads the diff through the GitHub API as data.
 * Sets commit status "agent-review" on the PR head SHA, which the merge decision reads.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { buildPrompt, commentBody, MARKER, MAX_ROUNDS, parseVerdict, pickModel, SCHEMA } from './review.mjs';

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
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function main() {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY secret is missing');
  status('pending', 'Gemini is reviewing');
  const pr = JSON.parse(gh('api', `repos/${REPO}/pulls/${PR}`));
  const files = gh('api', '--paginate', `repos/${REPO}/pulls/${PR}/files`, '--jq', '.[].filename').trim().split('\n').filter(Boolean);
  const diff = gh('pr', 'diff', PR, '--repo', REPO);
  const rules =
    readFileSync('AGENTS.md', 'utf8') + (files.some((f) => f.startsWith('src/lessons/')) ? `\n\n${readFileSync('docs/LESSON_GUIDE.md', 'utf8')}` : '');

  const model = pickModel((await gemini('models?pageSize=200')).models ?? []);
  const out = await gemini(`models/${model}:generateContent`, {
    method: 'POST',
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt({ rules, title: pr.title, body: pr.body, files, diff }) }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.1 },
    }),
  });
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
