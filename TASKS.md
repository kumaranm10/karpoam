# Task board

`[ ]` to do · `[~]` in progress (write owner) · `[x]` done · `[?]` blocked, question below
Owners: **claude**, **gemini** (Antigravity), **kumaran**, or **anyone**. Rules: see AGENTS.md → "How we work together".
Target before applying for AdSense: **12+ ready lessons across all 4 subjects.**

## Setup
- [ ] **K-1** kumaran — Create the GitHub repo and give Claude and Antigravity access.
- [ ] **K-2** kumaran — Choose the final name, buy the domain, set `url` (and `contactEmail`) in `src/site.json`.
- [ ] **K-3** kumaran — Cloudflare Pages: connect the repo, build `npm run build`, output `dist`, env `NODE_VERSION=22.23.5`, add custom domain. See docs/DEPLOY.md.
- [ ] **K-4** kumaran — Google Search Console: verify the domain, submit `/sitemap.xml`.
- [ ] **K-5** kumaran — After 12+ lessons: apply to AdSense, then put `ads.client` and `ads.slot` in `src/site.json`. Turn Auto ads OFF.

## Foundation
- [x] **C-1** claude — Astro site, design tokens, home/subject/level/lesson pages, parents/about/privacy, sitemap, ads.txt, AdSlot, lesson gate.
- [x] **C-2** claude — Widgets `groups`, `place-value`, `sort` + lessons: Maths P1 Tens and ones, Maths P2 Times tables, Science K2 Living or non-living.

## Widgets (claude)
- [ ] **C-3** claude — Widget `listen-pick`: hear a word or sound, tap the matching picture/letter (3–4 choices). Supports `audio` files and Tamil. Needed by G-5 and G-6.
- [ ] **C-4** claude — Widget `bonds`: number bonds (part-part-whole) with real objects, e.g. 7 sweets in two hands. Then lesson Maths K2/P1 "Number bonds to 10".
- [ ] **C-5** claude — Widget `count`: tap to count real objects 1–20 (one tap = one object lights up). Then lesson Maths K2 "Count to 20".
- [ ] **C-6** claude — Review every gemini PR: counts, facts, phone layout, voice.

## Lessons using existing widgets (gemini, data only)
- [ ] **G-1** gemini — Science K2 `float-or-sink` (sort). Household things a child can test in a basin. Include surprises (big orange with peel floats; small coin sinks). Every fact checked.
- [ ] **G-2** gemini — English K2 `vowels-and-consonants` (sort). Items are letters (use the letter as `icon`), `why` like “A is a vowel. Your mouth stays open.”
- [ ] **G-3** gemini — English P1 `naming-words` (sort, 3 bins: People / Animals / Things). Singapore examples (teacher, auntie, uncle, cat, bus, MRT train, umbrella).
- [ ] **G-4** gemini — Maths P1 `odd-or-even` (sort). Each item is a group of objects in pairs (e.g. icon `🧦🧦🧦🧦`, name “4 socks”); `why` says whether every sock has a partner.
- [ ] **G-5** gemini — Tamil K2 `uyir-ezhuthukkal` உயிர் எழுத்துகள் (needs C-3 `listen-pick`). 12 vowels, each with a picture word a child knows (அ — அம்மா, ஆ — ஆடு …). Record an MP3 per letter and word.
- [ ] **G-6** gemini — Tamil K2 `uyir-mei-sort` (sort, lang ta): sort letters into உயிர் / மெய். Tamil text only, with MP3s.
- [ ] **G-7** gemini — Science P1 `animal-homes` (sort, 3 bins: land / water / air or nest). Singapore animals where possible (otter, mynah, gecko).

## Polish (anyone)
- [ ] **A-1** anyone — Home page: when there are more than 9 lessons, show the newest 6 plus "See all" per subject.
- [ ] **A-2** anyone — Lighthouse check on phone: aim for 95+ performance and accessibility; fix what it finds.
