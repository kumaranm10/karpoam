# Karpom (கற்போம்) — rules for every AI agent and person working here

Read this whole file before you change anything. Antigravity/Gemini reads it automatically; Claude reads it through CLAUDE.md.

## What we are building
A free study site for children aged 5–8 in Singapore (K2, P1, P2 first; P3–P6 later).
Subjects: Maths, English, Science, Tamil (more later). Owner: Kumaran (parent, developer).
Goal is **not income**: at most one small child-safe ad per page, only to pay the ~SGD 20/year running cost.

## The five rules that matter most
1. **Pictures and doing, not reading.** One short sentence on screen at a time (aim for ≤ 12 words). Every sentence is read aloud.
2. **Real life first.** Teach with things a Singapore child knows: cookies on plates, cars, $10 notes and $1 coins, HDB lifts, MRT, hawker food, pets, plants.
3. **Counts must be exact.** Draw countable things with code (DOM/CSS/emoji repeated N times). Never use AI-generated images or video for anything a child must count. Never write a number that does not match the picture.
4. **Every lesson has 4 parts:** 1 See (story, child taps Next) → 2 Try (child builds/sorts) → 3 Check (picture quiz that explains every answer) → 🏠 At home (questions for parents, from the lesson JSON).
5. **Fast and safe.** No new runtime dependencies or external scripts without Kumaran's OK. No personal data, no accounts, no tracking cookies. Ads only via `src/components/AdSlot.astro`, never inside a lesson step.

## Tech stack
| Part | Choice |
|---|---|
| Framework | Astro 7 (static output), TypeScript, no UI framework |
| Lesson logic | Small vanilla TS "widgets" in `src/widgets/`, loaded only on pages that use them |
| Voice | Browser speech (`src/lib/voice.ts`); Tamil uses recorded MP3s in `public/audio/ta/` when given |
| Fonts | Self-hosted via @fontsource: Fredoka (display), Atkinson Hyperlegible (body), Noto Sans Tamil |
| Hosting | Cloudflare Pages, build `npm run build`, output `dist`, Node 22.23+ |

Commands: `npm install` · `npm run dev` (http://localhost:4321) · `npm run check` (lesson gate) · `npm run build` (gate + build).

## Folder map
```
src/site.json          site name, URL, contact email, ad IDs (empty = ads off), analytics token
src/catalog.json       subjects and levels (set a level "open": true when it has lessons)
src/lessons/<subject>/<level>/<slug>.json   ONE FILE PER LESSON (data only)
src/widgets/registry.ts   list of widget types
src/widgets/<name>.ts + <name>.css         a widget (interactive See/Try/Check)
src/lib/               voice.ts, sfx.ts, story.ts (the See player), dom.ts helpers
src/pages/             routes: /, /[subject]/, /[subject]/[level]/, /[subject]/[level]/[slug]/, parents, about, privacy
src/styles/            global.css (tokens + shared lesson UI), site.css (header, cards, footer)
scripts/check-lessons.mjs   the lesson gate; must pass before any PR
docs/LESSON_GUIDE.md   how to write a lesson JSON (read before adding one)
TASKS.md               the shared task board
```

## How we work together
Agents (see the ops repo `karpom-ops` for roadmap, status and decisions):

| Agent | Runs on | Label it picks up | Main jobs |
|---|---|---|---|
| Claude | GitHub Actions (cloud) | `agent:claude` | code, widgets, tests, planning, reviews Google agents' PRs |
| Gemini (cloud lane) | GitHub Actions (cloud) | `agent:gemini` | PR reviews, issue triage, small text fixes |
| Antigravity (`agy`) | Kumaran's computer (self-hosted runner, Docker) | `agent:antigravity` | lessons, Tamil content, bigger tasks, reviews Claude's PRs |

Flow for every task:
1. Tasks are GitHub issues (until milestone M3, `TASKS.md`). Only issues labelled `status:ready` and `agent:<you>` are yours.
2. Branch: `<agent>/<issue-number>-<slug>`. One task per branch, small PRs. Max 2 open PRs per agent.
3. Before pushing: `npm run build` passes and each changed page is checked at 390px width.
4. Open a PR using the template, with `Closes #<issue>`. Label `type:lesson` for lesson/text changes, `type:code` otherwise.
5. The other agent family reviews (Claude ↔ Google). Max 3 review rounds; then label `needs-kumaran`.
6. Merge: `type:code` auto-merges when all checks and the review pass. `type:lesson` also needs Kumaran's `content-approved` label.
7. If a check fails twice after your fixes, stop, label `needs-kumaran`, and explain in a comment.
8. If the repo variable `AGENTS_ENABLED` is `false`, do nothing.

Never change files listed in `.github/CODEOWNERS` without asking Kumaran in the PR. Do not edit files owned by another open PR. Do not reformat files you did not need to touch.

## Code rules
- TypeScript, no `any` in new lib code (widgets may read `params` as `Record<string, any>`).
- Widgets: `export default` a `Mount` function. Use `step()`, `storyPlayer()`, `speak()/say()`, `ding()/buzz()/cheer()` from `src/lib`. Look at `sort.ts` (data-driven) and `place-value.ts` (custom drawing) as examples.
- **Prefix every CSS class in a widget with a short widget prefix** (e.g. `so-`, `pv-`, `gr-`). All widget CSS ends up on the same page, so plain names like `.mini` collide.
- Colours only from tokens in `global.css` (`var(--ink)`, `var(--accent)`, …). Both light and dark mode must work.
- Buttons ≥ 48px tall, big tap targets, `type="button"`, visible focus. No drag-only interactions (tap must work).
- Every new number or count shown must come from the same variable that drew the picture.

## Content rules
- English: British spelling (colour, maths), Singapore context, short words. Never shame a wrong answer ("Not quite" + the reason).
- Tamil: Tamil script only (no Hindi/Devanagari, no Tanglish in Tamil fields). Use common spoken words a child hears at home. Include a recorded MP3 for each Tamil sentence that will be read aloud (`public/audio/ta/<lesson>/<id>.mp3`), because many phones have no Tamil voice.
- Science: facts must be correct for a curious adult too. When unsure, leave the item out.
- Maths: follow Singapore primary methods (number bonds, bar models, "groups of" for ×, count on by tens).

## Ads (only if `src/site.json` ads.client and ads.slot are set)
- Only `AdSlot.astro`, at most one per page, only after the "At home" section or at the page bottom.
- Keeps ≥ 150px from anything a child taps (the component has a 160px top margin; do not remove it).
- Child-directed tag stays on (`data-tag-for-age-treatment="1"`). Never use Auto ads, sticky/anchor ads or pop-ups.
