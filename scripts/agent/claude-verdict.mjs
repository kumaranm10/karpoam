#!/usr/bin/env node
/**
 * Cross-family review for Google-lane PRs (branches gemini/… and antigravity/…): Claude posts a review comment
 * through the Claude GitHub app; this script (run by agent-gate.yml from main on issue_comment) turns it into the
 * `agent-review` commit status, then runs the merge decision. It only trusts comments that
 *   - were posted via the "claude" GitHub app by the repo owner's account,
 *   - carry the claude-review marker, a clear verdict and the exact head SHA of the PR (stale reviews are ignored).
 */
import { execFileSync } from 'node:child_process';
import { GOOGLE_BRANCH, parseClaudeReview } from './review.mjs';

const { PR, COMMENT_ID, GITHUB_REPOSITORY: REPO } = process.env;
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' });
const pr = JSON.parse(gh('api', `repos/${REPO}/pulls/${PR}`));
const comment = JSON.parse(gh('api', `repos/${REPO}/issues/comments/${COMMENT_ID}`));
const owner = REPO.split('/')[0];

const why = (m) => {
  console.log(`Ignored: ${m}`);
  process.exit(0);
};
if (!GOOGLE_BRANCH.test(pr.head.ref)) why(`branch ${pr.head.ref} is not a Google-lane branch`);
if (comment.performed_via_github_app?.slug !== 'claude' || comment.user?.login !== owner) why('not posted by Claude');
const review = parseClaudeReview(comment.body);
if (!review) why('no clear verdict and sha');
if (review.sha !== pr.head.sha) why(`review is for ${review.sha.slice(0, 7)}, PR head is ${pr.head.sha.slice(0, 7)}`);

const ok = review.verdict === 'approve';
gh(
  'api',
  '-X',
  'POST',
  `repos/${REPO}/statuses/${pr.head.sha}`,
  '-f',
  `state=${ok ? 'success' : 'failure'}`,
  '-f',
  'context=agent-review',
  '-f',
  `description=${ok ? 'Approved by Claude' : 'Claude requested changes'}`,
);
console.log(`agent-review = ${ok ? 'success' : 'failure'} for ${pr.head.sha.slice(0, 7)}`);
