# Writing a lesson

A lesson is **one JSON file**: `src/lessons/<subject>/<level>/<slug>.json`.
Subject, level and slug come from the path (e.g. `src/lessons/science/k2/float-or-sink.json` → `/science/k2/float-or-sink/`).
If the widget you need already exists, a new lesson needs **no code at all**.

## Fields (all lessons)

| Field        | Required | Meaning                                                    |
| ------------ | -------- | ---------------------------------------------------------- |
| `title`      | yes      | Short name, e.g. "Tens and ones"                           |
| `titleTamil` | no       | Tamil lessons only: Tamil title, shown beside it           |
| `order`      | yes      | Sort order inside its level (10, 20, 30… leaves gaps)      |
| `icon`       | yes      | One emoji or one Tamil letter                              |
| `hook`       | yes      | One sentence (< 140 chars) a parent reads on the card      |
| `realLife`   | yes      | Real things used, e.g. `["ice-cream sticks", "$10 notes"]` |
| `widget`     | yes      | One of the widgets below                                   |
| `params`     | depends  | Settings for the widget                                    |
| `atHome`     | yes, ≥ 2 | `[{ "thing": "...", "ask": "..." }]` questions for parents |
| `tips`       | no       | 1–3 short tips for parents                                 |
| `status`     | yes      | `"draft"` (built but hidden, noindex) or `"ready"`         |

Run `npm run check` after every edit. It tells you exactly what is wrong.

## Widgets available now

| Widget        | Good for                                                                                                | params                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `sort`        | Any "which group?" idea: living/non-living, float/sink, vowels/consonants, odd/even, Tamil letter types | `bins`, `ask`, `items`, `story`, optional `clues`, `intro`, titles (see below) |
| `place-value` | Tens and ones (ice-cream stick bundles, $10/$1)                                                         | `target` (21–99, not ending in 0)                                              |
| `groups`      | Multiplication as equal groups / repeated addition                                                      | `n` (in each group, 2–6), `k` (groups, 2–6)                                    |

### `sort` params in detail

```json
{
  "bins": [
    { "id": "float", "label": "Floats", "icon": "🛟", "pick": "Tap the thing that floats." },
    { "id": "sink", "label": "Sinks", "icon": "⚓", "pick": "Tap the thing that sinks." }
  ],
  "ask": "Does the {name} float or sink?",
  "clues": [{ "icon": "🪶", "text": "light for its size" }],
  "intro": { "text": "Some things <b>float</b>. Some things <b>sink</b>.", "say": "Some things float on water. Some things sink to the bottom." },
  "story": [{ "item": "apple", "text": "An apple <b>floats</b>!", "say": "Plop! An apple floats.", "clues": [true] }],
  "items": [{ "id": "apple", "icon": "🍎", "name": "apple", "bin": "float", "why": "An apple floats because it has air inside." }]
}
```

- 2 or 3 bins; each bin needs ≥ 3 items; aim for 10–16 items in total.
- `why` is read aloud after every answer, right or wrong. Make it a real reason in ≤ 12 words.
- `story`: 3–5 examples, including at least one **surprising** one (robot moves but is non-living; a big log floats).
- `story[].clues`: one `true`/`false` per entry in `clues`.
- For Tamil, write `name`, `why`, `text`, `say` in Tamil and add `"audio": "/audio/ta/<lesson>/<id>.mp3"` per item.

## Writing checklist (the reviewer will check every line)

- [ ] Each on-screen sentence ≤ 12 words; the `say` version can be a little longer.
- [ ] Every example is something a 5–8 year old in Singapore has seen.
- [ ] Every count and fact is correct. Science facts checked against a reliable source.
- [ ] No shaming words. Wrong answers get "Not quite" + the reason.
- [ ] `atHome` questions use real objects and can be done in under 5 minutes.
- [ ] `npm run build` passes; page checked at 390px wide with sound on.

## Adding a new widget (when no existing widget fits)

1. Write a 5-line plan in the task: what the child sees, taps, and is asked.
2. Create `src/widgets/<name>.ts` (export default `Mount`) and `src/widgets/<name>.css` (classes prefixed, e.g. `bo-` for bonds).
3. Use the 3-step pattern: `step(root, 1, 'See: …')` + `storyPlayer`, `step(root, 2, 'Try: …')`, `step(root, 3, 'Check: …')`.
4. Add one line to `src/widgets/registry.ts`, add param checks to `scripts/check-lessons.mjs`, document params in this file.
