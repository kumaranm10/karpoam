/**
 * Widget "bonds": number bonds (part-part-whole) with real sweets shared between two hands.
 * See: count the sweets, share them into two hands, the bond diagram shows whole and parts; move one, the whole stays.
 * Try: tap a sweet to move it to the other hand; find every way to make the number.
 * Check: picture quiz. "7 = 3 + ?" (one hand closed) or "3 and 4 make ?" (both hands open). Every answer is explained.
 *
 * params: { "whole": 7 }   the story's number of sweets, 5–10 (default 7)
 *
 * Every number on screen comes from the same variable that draws the sweets.
 */
import './bonds.css';
import { h, plural, rnd, shuffle, step, uniq } from '../lib/dom';
import { buzz, cheer, ding } from '../lib/sfx';
import { storyPlayer } from '../lib/story';
import { say, speak } from '../lib/voice';
import type { Mount } from './registry';

export type BondQ = { type: 'part'; whole: number; a: number; opts: number[] } | { type: 'whole'; a: number; b: number; opts: number[] };

/** Every bond of `w` with the smaller part first: 7 → [0,7] [1,6] [2,5] [3,4]. */
export function bondsOf(w: number): [number, number][] {
  return Array.from({ length: Math.floor(w / 2) + 1 }, (_, i) => [i, w - i] as [number, number]);
}

/** Three choices: the answer once, plus two different near misses (never negative, never above 10). */
export function threeOptions(answer: number, near: number[]): number[] {
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v <= 10 && v !== answer;
  const wrong = uniq(shuffle(near.filter(ok))).slice(0, 2);
  for (let d = 1; wrong.length < 2 && d <= 10; d++)
    for (const v of [answer - d, answer + d]) if (wrong.length < 2 && ok(v) && !wrong.includes(v)) wrong.push(v);
  return shuffle([answer, ...wrong]);
}

/** One quiz question. `first` fixes the story's own bond so the quiz starts with what the child just saw. */
export function makeQuestion(first?: { whole: number; a: number }): BondQ {
  if (first || Math.random() < 0.6) {
    const whole = first?.whole ?? rnd(5, 10),
      a = first?.a ?? rnd(1, whole - 1),
      p = whole - a;
    return { type: 'part', whole, a, opts: threeOptions(p, [p + 1, p - 1, whole, a, p + 2]) };
  }
  const a = rnd(1, 6),
    b = rnd(1, 10 - a),
    w = a + b;
  return { type: 'whole', a, b, opts: threeOptions(w, [w + 1, w - 1, Math.abs(a - b), Math.max(a, b), w + 2]) };
}

const SWEET = '🍬';
interface HandOpts {
  /** Sweets become buttons; tapping one moves it to the other hand. */
  onMove?: (from: 0 | 1) => void;
  /** Close the second hand (its sweets are not drawn, so they cannot be counted). */
  hideB?: boolean;
  /** Light up sweet number `lit` (0-based, counting left hand first). */
  lit?: number;
}

/** Two hands holding `a` and `b` sweets. The sweets drawn are exactly a and b. */
function renderHands(el: HTMLElement, a: number, b: number, o: HandOpts = {}) {
  el.innerHTML = '';
  let k = 0;
  ([a, b] as const).forEach((count, side) => {
    const closed = side === 1 && o.hideB;
    const hand = h('div', {
      class: `bo-hand${closed ? ' bo-closed' : ''}`,
      'data-side': side,
      role: o.onMove ? 'group' : 'img',
      'aria-label': closed ? 'A closed hand. How many sweets inside?' : `${side ? 'Right' : 'Left'} hand: ${plural(count, 'sweet')}`,
    });
    hand.append(h('span', { class: `bo-palm${side ? '' : ' bo-flip'}`, 'aria-hidden': 'true' }, closed ? '✊' : '✋'));
    const box = h('div', { class: 'bo-sweets' });
    if (closed) box.append(h('span', { class: 'bo-q', 'aria-hidden': 'true' }, '?'));
    else
      for (let j = 0; j < count; j++, k++) {
        const lit = o.lit === k ? ' bo-lit' : '';
        if (o.onMove) {
          const btn = h(
            'button',
            { class: `bo-sweet bo-tap${lit}`, type: 'button', 'aria-label': `Move a sweet to the ${side ? 'left' : 'right'} hand` },
            SWEET,
          );
          btn.addEventListener('click', () => o.onMove!(side as 0 | 1));
          box.append(btn);
        } else box.append(h('span', { class: `bo-sweet${lit}`, 'aria-hidden': 'true' }, SWEET));
      }
    hand.append(box);
    el.append(hand);
  });
}

/** The Singapore number bond picture: whole on top, two parts below. `hide` shows "?" in that circle. */
function bondHTML(whole: number, a: number, b: number, hide?: 'whole' | 'b', hl?: 'whole') {
  const c = (cls: string, v: number, hid: boolean) => `<span class="bo-c ${cls}${hid ? ' bo-hid' : ''}">${hid ? '?' : v}</span>`;
  return `<div class="bo-bond${hl ? ' bo-hl' : ''}" role="img" aria-label="Number bond: ${hide === 'whole' ? '?' : whole} is ${a} and ${hide === 'b' ? '?' : b}">
<svg class="bo-lines" viewBox="0 0 220 170" aria-hidden="true"><line x1="110" y1="34" x2="46" y2="134"/><line x1="110" y1="34" x2="174" y2="134"/></svg>
${c('bo-w', whole, hide === 'whole')}${c('bo-a', a, false)}${c('bo-b', b, hide === 'b')}</div>`;
}
const eqHTML = (a: number, b: number) => `<div class="bo-eq"><span class="bo-pa">${a}</span> + <span class="bo-pb">${b}</span> = ${a + b}</div>`;

const mount: Mount = (root, params) => {
  const W = Math.max(5, Math.min(10, Math.round(Number(params.whole ?? 7)) || 7));
  const a1 = Math.floor((W - 1) / 2),
    b1 = W - a1,
    a2 = a1 - 1,
    b2 = W - a2;

  /* ---------- 1. See ---------- */
  const s1 = step(root, 1, 'See: sweets in two hands');
  const sc1 = h('div', { class: 'scene' });
  const sSay = h('div', { class: 'say', 'aria-live': 'polite' });
  const sHands = h('div', { class: 'bo-hands' });
  const sBond = h('div', { class: 'bo-wrap' });
  sc1.append(sSay, sHands, sBond);
  s1.append(sc1);
  const pile = (lit?: number) => {
    sHands.innerHTML = '';
    const bowl = h('div', { class: 'bo-bowl', role: 'img', 'aria-label': plural(W, 'sweet') });
    for (let j = 0; j < W; j++) bowl.append(h('span', { class: `bo-sweet${lit === j ? ' bo-lit' : ''}`, 'aria-hidden': 'true' }, SWEET));
    sHands.append(bowl);
  };
  const show = (a: number, b: number, bond: boolean, hl?: 'whole') => {
    renderHands(sHands, a, b);
    sBond.innerHTML = bond ? bondHTML(a + b, a, b, undefined, hl) + eqHTML(a, b) : '';
  };
  storyPlayer(s1, sSay, [
    {
      text: `You have <b>${W} sweets</b>.`,
      enter: () => {
        pile();
        sBond.innerHTML = '';
      },
      play: async (alive) => {
        await speak(`You have ${W} sweets. Let's count them.`);
        for (let j = 0; j < W; j++) {
          if (!alive()) return;
          pile(j);
          await speak(String(j + 1));
        }
        if (!alive()) return;
        pile();
        await speak(`${W} sweets.`);
      },
    },
    {
      text: 'Put some in <b>each hand</b>.',
      enter: () => show(a1, b1, false),
      play: async () => {
        await speak(`Put some in each hand. ${a1} in this hand. ${b1} in that hand.`);
      },
    },
    {
      text: `<b>${a1}</b> and <b>${b1}</b> make <b>${W}</b>.`,
      enter: () => show(a1, b1, true),
      play: async () => {
        await speak(`${a1} and ${b1} make ${W}. This is a number bond. ${W} is the whole. ${a1} and ${b1} are the parts.`);
      },
    },
    {
      text: `Move one sweet. <b>${a2}</b> and <b>${b2}</b> make ${W} too!`,
      enter: () => show(a2, b2, true),
      play: async () => {
        await speak(`Move one sweet to the other hand. Now ${a2} and ${b2}. They make ${W} too!`);
      },
    },
    {
      text: `The parts change. The whole stays <b>${W}</b>.`,
      enter: () => show(a2, b2, true, 'whole'),
      play: async () => {
        await speak(`The parts can change. The whole is still ${W} sweets. No sweets came or went.`);
      },
    },
    {
      text: 'Your turn! Tap a sweet to move it. 👇',
      enter: () => show(W, 0, false),
      play: async () => {
        await speak('Your turn! Tap a sweet to move it to the other hand.');
      },
    },
  ]);

  /* ---------- 2. Try ---------- */
  const s2 = step(root, 2, 'Try: share the sweets');
  const chal = h('div', { class: 'chal', 'aria-live': 'polite' });
  const steppers = h(
    'div',
    { class: 'steppers' },
    `<div class="stepper"><span class="lbl">Sweets altogether</span><div class="row"><button class="rb" type="button" data-a="w-" aria-label="One sweet less">−</button><span class="val" data-v="w"></span><button class="rb" type="button" data-a="w+" aria-label="One sweet more">+</button></div></div>`,
  );
  const sc2 = h('div', { class: 'scene' });
  const tSay = h('div', { class: 'say', 'aria-live': 'polite' });
  const tHands = h('div', { class: 'bo-hands' });
  const tBond = h('div', { class: 'bo-wrap' });
  const tFound = h('div', { class: 'bo-found', role: 'list', 'aria-label': 'Ways you found' });
  sc2.append(tSay, tHands, tBond, tFound);
  s2.append(chal, steppers, sc2);
  let tw = W,
    ta = W,
    found = new Set<number>(),
    won = false;
  const q = (sel: string) => steppers.querySelector(sel) as HTMLButtonElement;
  function drawTry(talk: boolean) {
    const tb = tw - ta;
    q('[data-v="w"]').textContent = String(tw);
    q('[data-a="w-"]').disabled = tw <= 2;
    q('[data-a="w+"]').disabled = tw >= 10;
    renderHands(tHands, ta, tb, { onMove: move });
    tBond.innerHTML = bondHTML(tw, ta, tb) + eqHTML(ta, tb);
    const pairs = bondsOf(tw);
    const key = Math.min(ta, tb);
    const isNew = !found.has(key);
    found.add(key);
    tFound.innerHTML = pairs
      .map(([x, y]) => `<span role="listitem" class="bo-chip${found.has(x) ? ' bo-got' : ''}${x === key ? ' bo-now' : ''}">${x} and ${y}</span>`)
      .join('');
    const all = found.size === pairs.length;
    tSay.innerHTML = `<b>${ta}</b> and <b>${tb}</b> make <b>${tw}</b>.`;
    chal.className = `chal${all ? ' won' : ''}`;
    chal.innerHTML = all
      ? `🎉 You found every way to make ${tw}!`
      : `Find every way to make <b>${tw}</b>.<span class="note">${found.size} of ${pairs.length} found</span>`;
    if (all && !won) {
      won = true;
      cheer();
    } else if (talk && isNew) ding();
    if (talk) say(all && isNew ? `${ta} and ${tb} make ${tw}. You found every way to make ${tw}!` : `${ta} and ${tb} make ${tw}.`);
  }
  function move(from: 0 | 1) {
    if (from === 0 && ta > 0) ta--;
    else if (from === 1 && ta < tw) ta++;
    else return;
    drawTry(true);
  }
  steppers.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.a;
    if (a === 'w-' && tw > 2) tw--;
    else if (a === 'w+' && tw < 10) tw++;
    else return;
    ta = tw;
    found = new Set();
    won = false;
    drawTry(false);
    say(`${tw} sweets. Find every way to share them.`);
  });
  drawTry(false);

  /* ---------- 3. Check ---------- */
  const s3 = step(root, 3, 'Check: picture quiz');
  const qText = h('div', { class: 'qtext' });
  const qNote = h('div', { class: 'note' });
  const qHands = h('div', { class: 'bo-hands' });
  const qBond = h('div', { class: 'bo-wrap' });
  const qOpts = h('div', { class: 'qopts' });
  const qFb = h('div', { class: 'qfb', 'aria-live': 'polite' });
  const qScore = h('span', { class: 'score' }, '0 of 0 right');
  const qNext = h('button', { class: 'btn go', type: 'button' }, 'Next question');
  const ctl3 = h('div', { class: 'ctl' });
  ctl3.append(qScore, qNext);
  s3.append(qText, qNote, qHands, qBond, qOpts, qFb, ctl3);
  let right = 0,
    asked = 0,
    touched = false,
    first = true,
    Q: BondQ;
  function newQ() {
    Q = makeQuestion(first ? { whole: W, a: a1 } : undefined);
    first = false;
    qFb.textContent = '';
    qFb.className = 'qfb';
    qOpts.innerHTML = '';
    let talk: string;
    if (Q.type === 'part') {
      const { whole, a } = Q;
      qText.innerHTML = `<b>${whole}</b> = <b>${a}</b> + ?`;
      qNote.textContent = `${whole} sweets in all. How many in the closed hand?`;
      renderHands(qHands, a, whole - a, { hideB: true });
      qBond.innerHTML = bondHTML(whole, a, whole - a, 'b');
      talk = `${whole} sweets in all. ${a} in this hand. How many in the closed hand?`;
    } else {
      const { a, b } = Q;
      qText.innerHTML = `<b>${a}</b> and <b>${b}</b> make ?`;
      qNote.textContent = 'How many sweets altogether?';
      renderHands(qHands, a, b);
      qBond.innerHTML = bondHTML(a + b, a, b, 'whole');
      talk = `${a} and ${b} make how many?`;
    }
    Q.opts.forEach((v, i) => {
      const b = h('button', { class: 'qopt', type: 'button' }, `${v}<span class="qc"></span>`);
      b.addEventListener('click', () => answer(i));
      qOpts.append(b);
    });
    if (touched) say(talk);
  }
  function answer(i: number) {
    touched = true;
    asked++;
    const a = Q.a,
      b = Q.type === 'part' ? Q.whole - Q.a : Q.b,
      whole = a + b,
      want = Q.type === 'part' ? b : whole,
      ok = Q.opts[i] === want;
    ([...qOpts.children] as HTMLButtonElement[]).forEach((btn, j) => {
      btn.disabled = true;
      const r = Q.opts[j] === want;
      btn.classList.add(r ? 'right' : 'wrong');
      btn.querySelector('.qc')!.textContent = r ? '✓' : '✗';
    });
    renderHands(qHands, a, b);
    qBond.innerHTML = bondHTML(whole, a, b) + eqHTML(a, b);
    const counts = (from: number, to: number) => Array.from({ length: to - from }, (_, k) => from + k + 1).join(', ');
    if (Q.type === 'part') {
      qFb.textContent = ok ? `🎉 Yes! ${a} and ${b} make ${whole}.` : `Not quite. ${a} and ${b} make ${whole}. ${b === 1 ? '1 was' : `${b} were`} hidden.`;
      say(ok ? `Yes! ${a} and ${b} make ${whole}.` : `Not quite. Count on from ${a}. ${counts(a, whole)}. That is ${b} more. ${a} and ${b} make ${whole}.`);
    } else {
      qFb.textContent = ok ? `🎉 Yes! ${a} and ${b} make ${whole}.` : `Not quite. Count them all: ${plural(whole, 'sweet')}.`;
      say(ok ? `Yes! ${a} and ${b} make ${whole}.` : `Not quite. Count on from ${a}. ${counts(a, whole)}. ${a} and ${b} make ${whole}.`);
    }
    if (ok) {
      right++;
      ding();
    } else buzz();
    qFb.className = `qfb ${ok ? 'ok' : 'no'}`;
    qScore.textContent = `${right} of ${asked} right`;
  }
  qNext.addEventListener('click', () => {
    touched = true;
    newQ();
  });
  newQ();
};
export default mount;
