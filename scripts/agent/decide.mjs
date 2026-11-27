/**
 * Merge decision for a PR. Pure function: easy to test, no network.
 * Used by .github/workflows/agent-gate.yml (which runs from main, never from the PR).
 */

/** Files that guard the process itself. Only Kumaran may approve changes to these (label `gate-approved`). */
export const HUMAN_ONLY = [/^\.github\/workflows\/agent-gate\.yml$/, /^scripts\/agent\//];

/** Files that define checks or rules. Need the other agent's review like everything else; listed for the review prompt. */
export const GATE = [
  /^\.github\//,
  /^scripts\//,
  /^(wrangler\.jsonc|biome\.json|lighthouserc\.json|vitest\.config\.ts|playwright\.config\.ts|tsconfig\.json|astro\.config\.mjs|package\.json|package-lock\.json)$/,
  /^(AGENTS|CLAUDE)\.md$/,
  /^src\/site\.json$/,
  /^src\/components\/AdSlot\.astro$/,
];

const LESSONISH = [/^src\/lessons\//, /^public\/audio\//];

/**
 * @param {{files: string[], labels: string[], author: string, agentReview: 'success'|'failure'|'pending'|'none'}} pr
 * @returns {{automerge: boolean, reason: string, needs: string[]}}
 */
export function decide({ files, labels, author, agentReview }) {
  const has = (l) => labels.includes(l);
  const needs = [];
  if (has('hold') || has('needs-kumaran')) return { automerge: false, reason: 'has a hold label', needs: ['remove hold / needs-kumaran'] };

  const humanOnly = files.filter((f) => HUMAN_ONLY.some((r) => r.test(f)));
  const lessonFiles = files.filter((f) => LESSONISH.some((r) => r.test(f)));
  const isLesson = has('type:lesson') || lessonFiles.length > 0;
  const isBot = author === 'dependabot[bot]';

  if (humanOnly.length && !has('gate-approved')) needs.push(`Kumaran's gate-approved label (changes the review/merge guards: ${humanOnly.join(', ')})`);
  if (!isBot && agentReview !== 'success' && !has('gate-approved')) needs.push('a passing agent review');
  if (isLesson && !has('content-approved')) needs.push("Kumaran's content-approved label (lesson or child-facing content)");

  if (needs.length) return { automerge: false, reason: `waiting for ${needs.join('; ')}`, needs };
  return { automerge: true, reason: 'all approvals present; GitHub merges when required checks pass', needs };
}

export const isGateFile = (f) => GATE.some((r) => r.test(f));
