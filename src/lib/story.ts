import { h } from './dom';
import { hush } from './voice';

export interface StoryStep {
  /** Caption shown on screen (may contain <b>, <span class>). Keep to one short sentence. */
  text: string;
  /** Draw the scene for this step, silently. Called on every visit. */
  enter: () => void;
  /** Narrate / animate when the child presses Start, Next or Again. Check `alive()` after every await. */
  play?: (alive: () => boolean) => Promise<void>;
}

/**
 * The "See" player: one sentence per screen, the child taps Next.
 * Adds dots + Back / Again / Next under `section`'s scene.
 */
export function storyPlayer(section: HTMLElement, sayEl: HTMLElement, steps: StoryStep[]) {
  let i = 0, tok = 0, started = false;
  const dots = h('div', { class: 'dots', 'aria-hidden': 'true' });
  const back = h('button', { class: 'btn', type: 'button' }, '◀ Back');
  const again = h('button', { class: 'btn', type: 'button' }, '🔊 Again');
  const next = h('button', { class: 'btn go', type: 'button' }, '▶ Start');
  const ctl = h('div', { class: 'ctl' });
  ctl.append(back, again, next);
  section.append(dots, ctl);

  function go(n: number, play: boolean) {
    i = Math.max(0, Math.min(steps.length - 1, n));
    const my = ++tok;
    hush();
    sayEl.innerHTML = steps[i].text;
    steps[i].enter();
    dots.innerHTML = steps.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('');
    back.disabled = i === 0;
    next.textContent = !started ? '▶ Start' : i === steps.length - 1 ? 'Start again ↺' : 'Next ▶';
    if (play && steps[i].play) void steps[i].play!(() => my === tok);
  }
  next.addEventListener('click', () => {
    if (!started) { started = true; go(0, true); return; }
    go(i === steps.length - 1 ? 0 : i + 1, true);
  });
  back.addEventListener('click', () => go(i - 1, started));
  again.addEventListener('click', () => { started = true; go(i, true); });
  go(0, false);

  return {
    /** True while the given step is on screen (use for tap-to-count steps). */
    isOn: (n: number) => i === n,
    setText: (html: string) => { sayEl.innerHTML = html; },
  };
}
