import { describe, expect, it } from 'vitest';
import lesson from '../../src/lessons/science/k2/living-and-non-living.json';
import { mountLesson, widgets } from '../../src/widgets/registry';

function host(widget: string, params: unknown) {
  const el = document.createElement('div');
  el.dataset.widget = widget;
  el.dataset.params = JSON.stringify(params);
  el.dataset.lang = 'en';
  document.body.append(el);
  return el;
}

describe('registry', () => {
  it('lists the three widgets', () => {
    expect(Object.keys(widgets).sort()).toEqual(['groups', 'place-value', 'sort']);
  });
  it('mounts a known widget from data attributes', async () => {
    const el = host('sort', lesson.params);
    await mountLesson(el);
    expect(el.querySelectorAll(':scope > section.step')).toHaveLength(3);
  });
  it('shows a friendly message for an unknown widget', async () => {
    const el = host('nope', {});
    await mountLesson(el);
    expect(el.textContent).toContain('not ready yet');
  });
});
