import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkLessons } from '../../scripts/lesson-rules.mjs';

const repo = join(import.meta.dirname, '..', '..');
type Result = { errors: string[]; warnings: string[]; count: number; widgets: string[] };

function fixture(files: Record<string, unknown>): string {
  const root = mkdtempSync(join(tmpdir(), 'lessons-'));
  mkdirSync(join(root, 'src/widgets'), { recursive: true });
  cpSync(join(repo, 'src/catalog.json'), join(root, 'src/catalog.json'));
  cpSync(join(repo, 'src/widgets/registry.ts'), join(root, 'src/widgets/registry.ts'));
  for (const [path, body] of Object.entries(files)) {
    const full = join(root, 'src/lessons', path);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, typeof body === 'string' ? body : JSON.stringify(body));
  }
  return root;
}
const good = {
  title: 'T',
  order: 1,
  icon: '🍦',
  hook: 'h',
  realLife: ['x'],
  widget: 'place-value',
  params: { target: 74 },
  atHome: [
    { thing: 'a', ask: 'b' },
    { thing: 'c', ask: 'd' },
  ],
  status: 'ready',
};
const run = (files: Record<string, unknown>) => checkLessons(fixture(files)) as Result;
const has = (r: Result, text: string) => r.errors.some((e) => e.includes(text));

describe('lesson rules', () => {
  it('the real lessons pass and all widgets are found', () => {
    const r = checkLessons(repo) as Result;
    expect(r.errors).toEqual([]);
    expect(r.count).toBeGreaterThanOrEqual(3);
    expect(r.widgets.sort()).toEqual(['groups', 'listen-pick', 'place-value', 'sort']);
  });
  it('accepts a correct lesson', () => {
    expect(run({ 'maths/p1/ok.json': good }).errors).toEqual([]);
  });
  it('rejects missing At home rows', () => {
    expect(has(run({ 'maths/p1/a.json': { ...good, atHome: [good.atHome[0]] } }), 'atHome')).toBe(true);
  });
  it('rejects unknown widgets, subjects, levels and bad file names', () => {
    expect(has(run({ 'maths/p1/a.json': { ...good, widget: 'magic' } }), 'does not exist')).toBe(true);
    expect(has(run({ 'art/p1/a.json': good }), 'unknown subject')).toBe(true);
    expect(has(run({ 'maths/p9/a.json': good }), 'unknown level')).toBe(true);
    expect(has(run({ 'maths/p1/Bad_Name.json': good }), 'kebab-case')).toBe(true);
  });
  it('rejects invalid JSON and wrong status', () => {
    expect(has(run({ 'maths/p1/a.json': '{oops' }), 'invalid JSON')).toBe(true);
    expect(has(run({ 'maths/p1/a.json': { ...good, status: 'live' } }), 'status')).toBe(true);
  });
  it('rejects Hindi characters anywhere', () => {
    expect(has(run({ 'tamil/k2/a.json': { ...good, title: 'அம்மா नमस्ते' } }), 'Devanagari')).toBe(true);
  });
  it('allows Tamil script only in Tamil lessons', () => {
    expect(has(run({ 'maths/p1/a.json': { ...good, titleTamil: 'பத்து' } }), 'Tamil script')).toBe(true);
    expect(has(run({ 'science/k2/a.json': { ...good, realLife: ['ஆடு'] } }), 'Tamil script')).toBe(true);
    expect(has(run({ 'tamil/k2/a.json': { ...good, title: 'அம்மா' } }), 'Tamil script')).toBe(false);
  });
  it('rejects missing audio files', () => {
    expect(has(run({ 'tamil/k2/a.json': { ...good, title: 'அ', params: { target: 74, audio: '/audio/ta/x/1.mp3' } } }), 'audio file')).toBe(true);
  });
  it('checks widget settings', () => {
    expect(has(run({ 'maths/p1/a.json': { ...good, params: { target: 70 } } }), 'place-value target')).toBe(true);
    expect(has(run({ 'maths/p2/a.json': { ...good, widget: 'groups', params: { n: 9 } } }), 'groups n')).toBe(true);
    const bins = [
      { id: 'a', label: 'A', icon: 'a', pick: 'Tap A' },
      { id: 'b', label: 'B', icon: 'b', pick: 'Tap B' },
    ];
    const item = (id: string, bin: string) => ({ id, icon: '🍎', name: id, bin, why: 'because' });
    const sortLesson = {
      ...good,
      widget: 'sort',
      params: { bins, ask: 'Where is {name}?', items: [item('x', 'a'), item('y', 'zzz')], story: [{ item: 'nope', text: 't' }] },
    };
    const r = run({ 'science/k2/s.json': sortLesson });
    expect(has(r, 'not one of the bins')).toBe(true);
    expect(has(r, 'needs at least 3 items')).toBe(true);
    expect(has(r, 'is not an item id')).toBe(true);
  });
  it('checks listen-pick settings', () => {
    const it4 = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, icon: ['🐱', '🐶', '🐟', '🐦'][i], name: id }));
    const lp = (params: unknown) => ({ ...good, widget: 'listen-pick', params });
    expect(run({ 'english/k2/ok.json': lp({ items: it4, choices: 4, story: [{ item: 'a', text: 'A' }] }) }).errors).toEqual([]);
    expect(has(run({ 'english/k2/a.json': lp({ items: it4.slice(0, 3) }) }), 'at least 4 items')).toBe(true);
    expect(has(run({ 'english/k2/a.json': lp({ items: [...it4, { ...it4[0], id: 'e' }] }) }), 'used twice')).toBe(true);
    expect(has(run({ 'english/k2/a.json': lp({ items: [...it4.slice(1), { id: 'z', icon: '🐱', name: 'b' }] }) }), 'name "b" is used twice')).toBe(true);
    expect(has(run({ 'english/k2/a.json': lp({ items: [...it4, { id: 'e', icon: '🐱', name: 'e' }] }) }), 'icon "🐱" is used twice')).toBe(true);
    expect(has(run({ 'english/k2/a.json': lp({ items: [...it4, { id: 'e', icon: '🦆' }] }) }), 'items[4].name')).toBe(true);
    expect(has(run({ 'english/k2/a.json': lp({ items: it4, choices: 5 }) }), 'choices must be 3 or 4')).toBe(true);
    expect(has(run({ 'english/k2/a.json': lp({ items: it4, story: [{ item: 'x' }] }) }), 'is not an item id')).toBe(true);
    expect(has(run({ 'english/k2/a.json': lp({ items: it4, story: [{ item: 'a' }] }) }), 'story[0].text')).toBe(true);
    const ta = run({ 'tamil/k2/a.json': { ...lp({ items: it4 }), title: 'அ' } });
    expect(ta.warnings.some((w) => w.includes('no "audio"'))).toBe(true);
  });
});
