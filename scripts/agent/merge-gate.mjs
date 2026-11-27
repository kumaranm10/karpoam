#!/usr/bin/env node
/** Applies decide() to a PR: turns GitHub auto-merge on or off. Runs from main in agent-gate.yml. */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { decide } from './decide.mjs';

const { PR, REPO = process.env.GITHUB_REPOSITORY, GITHUB_STEP_SUMMARY } = process.env;
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' });
const pr = JSON.parse(gh('api', `repos/${REPO}/pulls/${PR}`));
const files = gh('api', '--paginate', `repos/${REPO}/pulls/${PR}/files`, '--jq', '.[].filename').trim().split('\n').filter(Boolean);
const statuses = JSON.parse(gh('api', `repos/${REPO}/commits/${pr.head.sha}/statuses`));
const latest = statuses.find((s) => s.context === 'agent-review');
const result = decide({ files, labels: pr.labels.map((l) => l.name), author: pr.user.login, agentReview: latest?.state ?? 'none' });

const line = `Auto-merge ${result.automerge ? 'ON' : 'OFF'}: ${result.reason}`;
console.log(line);
if (GITHUB_STEP_SUMMARY) appendFileSync(GITHUB_STEP_SUMMARY, `${line}\n`);
try {
  gh('pr', 'merge', PR, '--repo', REPO, ...(result.automerge ? ['--auto', '--squash'] : ['--disable-auto']));
} catch (e) {
  if (result.automerge) throw e; // turning off when already off is fine
}
