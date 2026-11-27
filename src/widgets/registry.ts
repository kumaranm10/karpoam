/**
 * Every interactive lesson type. A lesson JSON names one of these in "widget".
 * To add a widget: create src/widgets/<name>.ts exporting `default` (a Mount), then add one line here.
 * Each widget is loaded only on the lessons that use it, so pages stay small.
 */
export interface WidgetCtx {
  lang: 'en' | 'ta';
  title: string;
}
// biome-ignore lint/suspicious/noExplicitAny: lesson params are free-form JSON, checked by scripts/check-lessons.mjs
export type Mount = (root: HTMLElement, params: Record<string, any>, ctx: WidgetCtx) => void;

export const widgets: Record<string, () => Promise<{ default: Mount }>> = {
  bonds: () => import('./bonds'),
  groups: () => import('./groups'),
  'listen-pick': () => import('./listen-pick'),
  'place-value': () => import('./place-value'),
  sort: () => import('./sort'),
};

export async function mountLesson(root: HTMLElement) {
  const name = root.dataset.widget ?? '';
  const load = widgets[name];
  if (!load) {
    root.innerHTML = `<p class="muted">This lesson is not ready yet.</p>`;
    return;
  }
  const params = JSON.parse(root.dataset.params || '{}');
  const ctx: WidgetCtx = { lang: (root.dataset.lang as 'en' | 'ta') || 'en', title: root.dataset.title || '' };
  const mod = await load();
  root.innerHTML = '';
  mod.default(root, params, ctx);
}
