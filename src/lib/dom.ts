/** Tiny DOM helpers shared by all lesson widgets. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, attrs: Record<string, string | number | boolean | undefined> = {}, html = '',
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') el.className = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  if (html) el.innerHTML = html;
  return el;
}

/**
 * One numbered lesson step ("1 · See", "2 · Try", "3 · Check").
 * Returns the section; widgets append their scene and buttons into it.
 */
export function step(root: HTMLElement, n: number, title: string): HTMLElement {
  const s = h('section', { class: 'step', 'aria-label': title });
  s.append(h('div', { class: 'step-head' }, `<span class="step-num" aria-hidden="true">${n}</span><span class="step-title">${title}</span>`));
  root.append(s);
  return s;
}

export const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const uniq = <T>(a: T[]) => a.filter((v, i) => a.indexOf(v) === i);
export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
