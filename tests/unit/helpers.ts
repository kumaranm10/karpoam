/** Shared helpers for widget tests. */
export function mountRoot(): HTMLElement {
  document.body.innerHTML = '';
  const root = document.createElement('div');
  document.body.append(root);
  return root;
}
export const steps = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(':scope > section.step')];
export const click = (el: Element | null | undefined) => {
  if (!el) throw new Error('element not found');
  (el as HTMLElement).click();
};
export const btn = (scope: ParentNode, text: string) => [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text));
