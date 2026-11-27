/**
 * Widget "groups": multiplication as equal groups / repeated addition.
 * See: cookies on plates story. Try: make k plates of n. Real life: a thing for every table 1–10. Check: picture quiz.
 * params: { "n": 4, "k": 3 }  (story uses k plates of n cookies; defaults 4 and 3)
 */
import './groups.css';
import { h, rnd, shuffle, step, uniq } from '../lib/dom';
import { buzz, cheer, ding } from '../lib/sfx';
import { storyPlayer } from '../lib/story';
import { say, speak } from '../lib/voice';
import type { Mount } from './registry';

interface Theme {
  key: string;
  shape: 'plate' | 'box' | 'gr-mini';
  hd: string;
  cols: (n: number) => number;
  item: (j: number) => string;
  tile?: string;
  one?: string;
  many?: string;
  a?: string;
  as?: string;
}
const emo = (e: string) => `<span class="it">${e}</span>`;
const plateCols = (n: number) => (n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : n <= 8 ? 4 : 5);
const COOKIE: Theme = { key: 'cookie', shape: 'plate', hd: '', cols: plateCols, item: () => emo('🍪') };
const MINI: Theme = { key: 'mini', shape: 'gr-mini', hd: '', cols: (n) => (n <= 3 ? n : n === 4 ? 2 : 3), item: () => '<span class="it dot"></span>' };
const box = (t: Omit<Theme, 'key' | 'shape'>, k: number): Theme => ({ ...t, key: `t${k}`, shape: 'box' });
/** Real things for each table. Counts are drawn from these, so they are always exact. */
const THINGS: Record<number, Theme> = {
  1: box({ tile: '👃', one: 'child', many: 'children', a: 'nose', as: 'noses', hd: '🧒', cols: () => 1, item: () => emo('👃') }, 1),
  2: box({ tile: '🚲', one: 'bicycle', many: 'bicycles', a: 'wheel', as: 'wheels', hd: '🚲', cols: () => 2, item: () => '<span class="it wheel"></span>' }, 2),
  3: box(
    { tile: '🚦', one: 'traffic light', many: 'traffic lights', a: 'light', as: 'lights', hd: '', cols: () => 1, item: (j) => emo(['🔴', '🟡', '🟢'][j]) },
    3,
  ),
  4: box({ tile: '🚗', one: 'car', many: 'cars', a: 'wheel', as: 'wheels', hd: '🚗', cols: () => 2, item: () => '<span class="it wheel"></span>' }, 4),
  5: box({ tile: '✋', one: 'hand', many: 'hands', a: 'finger', as: 'fingers', hd: '✋', cols: () => 5, item: () => '<span class="it arm finger"></span>' }, 5),
  6: box({ tile: '🥚', one: 'egg box', many: 'egg boxes', a: 'egg', as: 'eggs', hd: '', cols: () => 3, item: () => emo('🥚') }, 6),
  7: box(
    { tile: '📅', one: 'week', many: 'weeks', a: 'day', as: 'days', hd: '📅', cols: () => 7, item: (j) => `<span class="it let">${'MTWTFSS'[j]}</span>` },
    7,
  ),
  8: box({ tile: '🐙', one: 'octopus', many: 'octopuses', a: 'arm', as: 'arms', hd: '🐙', cols: () => 8, item: () => '<span class="it arm"></span>' }, 8),
  9: box(
    {
      tile: '#️⃣',
      one: 'tic-tac-toe board',
      many: 'tic-tac-toe boards',
      a: 'square',
      as: 'squares',
      hd: '',
      cols: () => 3,
      item: () => '<span class="it sq"></span>',
    },
    9,
  ),
  10: box({ tile: '🖍️', one: 'box of crayons', many: 'boxes of crayons', a: 'crayon', as: 'crayons', hd: '', cols: () => 5, item: () => emo('🖍️') }, 10),
};

interface RenderOpts {
  count: number;
  n: number;
  theme: Theme;
  totals?: number;
  onTap?: (i: number) => void;
  hl?: number | 'all';
}
type Tracked = HTMLElement & { _key?: string; _prev?: number; _tot?: number };

function renderGroups(el: Tracked, o: RenderOpts) {
  const key = `${o.theme.key}:${o.n}`;
  const same = el._key === key,
    prev = same ? (el._prev ?? 0) : 0,
    prevTot = same ? (el._tot ?? 0) : 0;
  el.innerHTML = '';
  for (let i = 0; i < o.count; i++) {
    const g = h('div', { class: `grp${i >= prev ? ' new' : ''}${o.hl === i || o.hl === 'all' ? ' hl' : ''}` });
    if (i >= prev) g.style.animationDelay = `${(i - prev) * 90}ms`;
    const b = document.createElement(o.onTap ? 'button' : 'div');
    b.className = o.theme.shape + (o.n > 6 && o.theme.shape === 'plate' ? ' small' : '');
    if (o.onTap) {
      (b as HTMLButtonElement).type = 'button';
      b.setAttribute('aria-label', `Plate ${i + 1}`);
      b.addEventListener('click', () => o.onTap!(i));
    }
    let inner = o.theme.hd ? `<span class="hd" aria-hidden="true">${o.theme.hd}</span>` : '';
    inner += `<span class="items" aria-hidden="true" style="grid-template-columns:repeat(${o.theme.cols(o.n)},auto)">`;
    for (let j = 0; j < o.n; j++) inner += o.theme.item(j);
    b.innerHTML = `${inner}</span>`;
    g.append(b);
    if (o.totals !== undefined) {
      const on = i < o.totals;
      g.append(h('span', { class: `tot${on ? ' on' : ''}${on && i >= prevTot ? ' popin' : ''}` }, String((i + 1) * o.n)));
    }
    el.append(g);
  }
  el._key = key;
  el._prev = o.count;
  el._tot = o.totals ?? 0;
}

function eqHTML(chips: number, n: number, o: { lit?: boolean; same?: boolean; times?: boolean } = {}) {
  if (chips <= 0) return '';
  const parts = Array.from({ length: chips }, () => `<span class="ec${o.lit ? ' lit' : ''}">${n}</span>`);
  let s = `<div class="eqline">${parts.join('<span class="plus">+</span>')}${chips > 1 ? `<span>= ${chips * n}</span>` : ''}</div>`;
  if (o.same) s += `<div class="words"><span class="g">${chips} plates</span> of <span class="o">${n}</span></div>`;
  if (o.times)
    s += `<div class="times"><span class="g">${chips}</span> × <span class="o">${n}</span> = ${chips * n}</div><div class="note">× means “groups of”</div>`;
  return s;
}
const addStr = (n: number, k: number) => Array(k).fill(n).join(' + ');
const thingWord = (T: Theme, k: number) => `${k} ${k === 1 ? T.one : T.many}`;
const itemWord = (T: Theme, v: number) => `${v} ${v === 1 ? T.a : T.as}`;
const groupsText = (g: number, n: number) => `${g} ${g === 1 ? 'group' : 'groups'} of ${n}`;

const mount: Mount = (root, params) => {
  const N = Number(params.n ?? 4),
    K = Number(params.k ?? 3);

  /* ---------- 1. See ---------- */
  const s1 = step(root, 1, 'See: cookies on plates');
  const scene1 = h('div', { class: 'scene' });
  const sSay = h('div', { class: 'say', 'aria-live': 'polite' });
  const sGroups = h('div', { class: 'groups' }) as Tracked;
  const sEq = h('div', { class: 'eq' });
  scene1.append(sSay, sGroups, sEq);
  s1.append(scene1);
  let tapped = 0;
  const drawS = (count: number, totals: number, eq: { chips?: number; same?: boolean; lit?: boolean; times?: boolean; tap?: boolean; hl?: 'all' } = {}) => {
    renderGroups(sGroups, { count, n: N, theme: COOKIE, totals, onTap: eq.tap ? tapPlate : undefined, hl: eq.hl });
    sEq.innerHTML = eqHTML(eq.chips ?? 0, N, eq);
  };
  const story = storyPlayer(s1, sSay, [
    {
      text: `Grandma puts <b>${N} cookies</b> on a plate.`,
      enter: () => drawS(1, 0),
      play: async (alive) => {
        await speak(`Grandma puts ${N} cookies on a plate. Let's count them.`);
        if (!alive()) return;
        const its = [...sGroups.querySelectorAll('.it')];
        for (let j = 0; j < its.length; j++) {
          for (const x of its) x.classList.remove('lit');
          its[j].classList.add('lit');
          await speak(String(j + 1));
          if (!alive()) return;
        }
        for (const x of its) x.classList.remove('lit');
        drawS(1, 1, { chips: 1 });
        await speak(`${N} cookies.`);
      },
    },
    {
      text: `Here is <b>another plate</b>. It has ${N} cookies too.`,
      enter: () => drawS(2, 1, { chips: 1 }),
      play: async (alive) => {
        await speak(`Here is another plate. It has ${N} cookies too.`);
        if (!alive()) return;
        drawS(2, 2, { chips: 2 });
        await speak(`${N}, and ${N} more, make ${2 * N}.`);
      },
    },
    {
      text: `<b>More plates</b>, ${N} cookies on each!`,
      enter: () => drawS(K, 0),
      play: async (alive) => {
        await speak(`More plates. ${N} cookies on each! Let's count by ${N}s.`);
        if (!alive()) return;
        for (let k = 1; k <= K; k++) {
          drawS(K, k, { chips: k });
          await speak(String(N * k));
          if (!alive()) return;
        }
        await speak(`${N * K} cookies altogether!`);
      },
    },
    {
      text: `Every plate has the <b>same</b>: ${N} cookies.`,
      enter: () => drawS(K, K, { chips: K, same: true, lit: true, hl: 'all' }),
      play: async () => {
        await speak(`Look. Every plate has the same number. ${N} cookies. So we have ${K} plates of ${N}.`);
      },
    },
    {
      text: 'A short way to write it:',
      enter: () => drawS(K, K, { chips: K, times: true }),
      play: async () => {
        await speak(`Here is a short way to write ${K} plates of ${N}. ${K} times ${N}. ${K} times ${N} is ${N * K}. Times means groups of.`);
      },
    },
    {
      text: `Your turn! <b>Tap each plate</b> and count by ${N}s.`,
      enter: () => {
        tapped = 0;
        drawS(K, 0, { tap: true });
      },
      play: async () => {
        await speak(`Your turn! Tap each plate, and count by ${N}s.`);
      },
    },
  ]);
  function tapPlate() {
    if (!story.isOn(5) || tapped >= K) return;
    tapped++;
    if (tapped < K) {
      drawS(K, tapped, { chips: tapped, tap: true });
      say(String(N * tapped));
      return;
    }
    drawS(K, K, { chips: K, times: true });
    story.setText(`<span class="party">🎉</span>&nbsp;You did it! ${K} plates of ${N} make ${N * K}.`);
    cheer();
    say(`${N * K}! You did it! ${K} plates of ${N} make ${N * K}. ${K} times ${N} is ${N * K}.`);
  }

  /* ---------- 2. Try: make it ---------- */
  const s2 = step(root, 2, 'Try: make it yourself');
  const chal = h('div', { class: 'chal' });
  const steppers = h(
    'div',
    { class: 'steppers' },
    `
    <div class="stepper"><span class="lbl">Plates</span><div class="row"><button class="rb" type="button" data-a="g-" aria-label="One less plate">−</button><span class="val" data-v="g"></span><button class="rb" type="button" data-a="g+" aria-label="One more plate">+</button></div></div>
    <div class="stepper"><span class="lbl">Cookies on each plate</span><div class="row"><button class="rb o" type="button" data-a="n-" aria-label="One less cookie on each plate">−</button><span class="val" data-v="n"></span><button class="rb o" type="button" data-a="n+" aria-label="One more cookie on each plate">+</button></div></div>`,
  );
  const scene2 = h('div', { class: 'scene' });
  const mWords = h('div', { class: 'words', 'aria-live': 'polite' });
  const mGroups = h('div', { class: 'groups' }) as Tracked;
  const mEq = h('div', { class: 'eq' });
  scene2.append(mWords, mGroups, mEq);
  const mNew = h('button', { class: 'btn', type: 'button' }, 'New challenge');
  const ctl2 = h('div', { class: 'ctl' });
  ctl2.append(mNew);
  s2.append(chal, steppers, scene2, ctl2);
  let mg = 2,
    mn = 3,
    target = { g: 3, n: 2 },
    won = false;
  const q = (sel: string) => steppers.querySelector(sel) as HTMLButtonElement;
  function drawM(talk: boolean) {
    q('[data-v="g"]').textContent = String(mg);
    q('[data-v="n"]').textContent = String(mn);
    q('[data-a="g-"]').disabled = mg <= 1;
    q('[data-a="g+"]').disabled = mg >= 5;
    q('[data-a="n-"]').disabled = mn <= 1;
    q('[data-a="n+"]').disabled = mn >= 10;
    renderGroups(mGroups, { count: mg, n: mn, theme: COOKIE, totals: mg });
    mEq.innerHTML = eqHTML(mg, mn, { times: mg > 1 });
    mWords.innerHTML = `<span class="g">${mg} ${mg === 1 ? 'plate' : 'plates'}</span> with <span class="o">${mn} ${mn === 1 ? 'cookie' : 'cookies'}</span> on each`;
    const hit = mg === target.g && mn === target.n;
    if (hit && !won) {
      won = true;
      cheer();
    }
    chal.className = `chal${hit ? ' won' : ''}`;
    chal.innerHTML = hit
      ? `🎉 Yes! ${target.g} plates of ${target.n} make ${target.g * target.n}. That is ${target.g} × ${target.n}.`
      : `Can you make <b>${target.g} × ${target.n}</b>?<span class="note">That means ${target.g} plates, ${target.n} cookies on each.</span>`;
    if (talk)
      say(
        hit
          ? `Yes! ${target.g} plates of ${target.n} make ${target.g * target.n}. You made ${target.g} times ${target.n}!`
          : `${mg} ${mg === 1 ? 'plate' : 'plates'} of ${mn} make ${mg * mn}.`,
      );
  }
  steppers.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.a;
    if (a === 'g-' && mg > 1) mg--;
    else if (a === 'g+' && mg < 5) mg++;
    else if (a === 'n-' && mn > 1) mn--;
    else if (a === 'n+' && mn < 10) mn++;
    else return;
    drawM(true);
  });
  mNew.addEventListener('click', () => {
    let t: { g: number; n: number };
    do {
      t = { g: rnd(2, 5), n: rnd(2, 6) };
    } while ((t.g === mg && t.n === mn) || (t.g === target.g && t.n === target.n));
    target = t;
    won = false;
    drawM(false);
    say(`Can you make ${t.g} times ${t.n}? That means ${t.g} plates, with ${t.n} cookies on each plate.`);
  });
  drawM(false);

  /* ---------- 3. Real life ---------- */
  const s3 = step(root, 3, 'Times tables all around us');
  s3.append(h('p', { class: 'lede' }, 'Every table from 1 to 10 has something real to count. Pick one, then add one more each time.'));
  const tiles = h('div', { class: 'tiles', role: 'group', 'aria-label': 'Choose a table' });
  const scene3 = h('div', { class: 'scene' });
  const rSay = h('div', { class: 'say', 'aria-live': 'polite' });
  const rGroups = h('div', { class: 'groups' }) as Tracked;
  const rEq = h('div', { class: 'eq' });
  scene3.append(rSay, rGroups, rEq);
  const rMinus = h('button', { class: 'btn', type: 'button' }, '− one less');
  const rPlus = h('button', { class: 'btn go', type: 'button' }, '+ one more');
  const ctl3 = h('div', { class: 'ctl' });
  ctl3.append(rMinus, rPlus);
  const rList = h('tbody');
  const tw = h('div', { class: 'tw' });
  const tbl = h('table', { class: 'tlist' });
  tbl.append(rList);
  tw.append(tbl);
  s3.append(tiles, scene3, ctl3, tw);
  let rn = 4,
    rk = 3;
  for (let n = 1; n <= 10; n++) {
    const T = THINGS[n];
    const b = h(
      'button',
      { class: 'tile', type: 'button', 'aria-label': `Table of ${n}: ${T.as} on ${T.many}` },
      `<span class="ti" aria-hidden="true">${T.tile}</span><span class="tn">${n}</span>`,
    );
    b.addEventListener('click', () => {
      rn = n;
      rk = 1;
      drawR(true, true);
    });
    tiles.append(b);
  }
  function drawR(talk: boolean, intro = false) {
    const T = THINGS[rn];
    [...tiles.children].forEach((b, i) => {
      b.setAttribute('aria-pressed', String(i + 1 === rn));
    });
    rSay.innerHTML = `Each ${T.one} has <b class="o">${itemWord(T, rn)}</b>.`;
    renderGroups(rGroups, { count: rk, n: rn, theme: T, totals: rk });
    rEq.innerHTML =
      eqHTML(rk, rn, { times: rk > 1 }) +
      `<div class="words">${thingWord(T, rk)} ${rk === 1 ? 'has' : 'have'} <span class="o">${itemWord(T, rk * rn)}</span>.</div>`;
    rMinus.disabled = rk <= 1;
    rPlus.disabled = rk >= 10;
    rPlus.textContent = rk >= 10 ? 'That’s 10!' : `+ one more ${T.one}`;
    rList.innerHTML = '';
    for (let k = 1; k <= 10; k++) {
      const tr = h(
        'tr',
        { class: k === rk ? 'now' : k > rk ? 'later' : '' },
        `<td>${thingWord(T, k)} → ${itemWord(T, k * rn)}</td><td class="x">${k} × ${rn} = ${k * rn}</td>`,
      );
      tr.addEventListener('click', () => {
        rk = k;
        drawR(true);
      });
      rList.append(tr);
    }
    if (talk) {
      const res = `${thingWord(T, rk)} ${rk === 1 ? 'has' : 'have'} ${itemWord(T, rk * rn)}.`;
      say(intro ? `Each ${T.one} has ${itemWord(T, rn)}. ${res}` : res);
    }
  }
  rPlus.addEventListener('click', () => {
    if (rk < 10) {
      rk++;
      drawR(true);
    }
  });
  rMinus.addEventListener('click', () => {
    if (rk > 1) {
      rk--;
      drawR(true);
    }
  });
  drawR(false);

  /* ---------- 4. Check ---------- */
  const s4 = step(root, 4, 'Check: picture quiz');
  const qText = h('div', { class: 'qtext' });
  const qPic = h('div', { class: 'groups' }) as Tracked;
  const qOpts = h('div', { class: 'qopts' });
  const qFb = h('div', { class: 'qfb', 'aria-live': 'polite' });
  const qScore = h('span', { class: 'score' }, '0 of 0 right');
  const qNext = h('button', { class: 'btn go', type: 'button' }, 'Next question');
  const ctl4 = h('div', { class: 'ctl' });
  ctl4.append(qScore, qNext);
  s4.append(qText, qPic, qOpts, qFb, ctl4);
  type Q = { type: 'count'; n: number; k: number; opts: number[] } | { type: 'pick'; a: number; b: number; opts: [number, number][] };
  let right = 0,
    asked = 0,
    firstQ = true,
    touched = false,
    Qc: Q;
  function makeQ(): Q {
    if (firstQ) {
      firstQ = false;
      return { type: 'count', n: 4, k: 3, opts: [12, 7, 16] };
    }
    if (Math.random() < 0.55) {
      const n = [2, 3, 4, 5, 10][rnd(0, 4)],
        k = rnd(2, 4),
        t = n * k;
      const c = uniq(shuffle([t + n, t - n, n + k, t + 1].filter((v) => v > 0 && v !== t))).slice(0, 2);
      return { type: 'count', n, k, opts: shuffle([t, ...c]) };
    }
    const a = rnd(2, 3),
      b = rnd(2, 4),
      t = a * b;
    const cand = shuffle(
      (
        [
          [a, b + 1],
          [a + 1, b],
          [a, b - 1],
          [a - 1, b],
        ] as [number, number][]
      ).filter(([g, n]) => g >= 1 && n >= 1 && g * n !== t && !(g === b && n === a)),
    );
    const seen = new Set([`${a},${b}`]),
      picks: [number, number][] = [];
    for (const p of cand) {
      if (!seen.has(p.join(','))) {
        seen.add(p.join(','));
        picks.push(p);
      }
      if (picks.length === 2) break;
    }
    return { type: 'pick', a, b, opts: shuffle([[a, b], ...picks]) };
  }
  function newQ() {
    Qc = makeQ();
    qFb.textContent = '';
    qFb.className = 'qfb';
    qOpts.innerHTML = '';
    if (Qc.type === 'count') {
      const T = THINGS[Qc.n];
      qText.innerHTML = `${thingWord(T, Qc.k)}. How many ${T.as}?`;
      renderGroups(qPic, { count: Qc.k, n: Qc.n, theme: T, totals: 0 });
      qPic.hidden = false;
      Qc.opts.forEach((v, i) => {
        const b = h('button', { class: 'qopt', type: 'button' }, `${v}<span class="qc"></span>`);
        b.addEventListener('click', () => answer(i));
        qOpts.append(b);
      });
      if (touched) say(`${thingWord(T, Qc.k)}. How many ${T.as}?`);
    } else {
      const { a, b } = Qc;
      qText.innerHTML = `Which picture shows <b><span class="g">${a}</span> × <span class="o">${b}</span></b>?`;
      qPic.hidden = true;
      Qc.opts.forEach(([g, n], i) => {
        const btn = h('button', { class: 'qopt', type: 'button', 'aria-label': `${g} plates with ${n} on each` });
        const pic = h('div', { class: 'groups' }) as Tracked;
        renderGroups(pic, { count: g, n, theme: MINI });
        btn.append(pic, h('span', { class: 'qc' }));
        btn.addEventListener('click', () => answer(i));
        qOpts.append(btn);
      });
      if (touched) say(`Which picture shows ${a} times ${b}? That is ${a} groups of ${b}.`);
    }
  }
  function answer(i: number) {
    touched = true;
    asked++;
    const btns = [...qOpts.children] as HTMLButtonElement[];
    let ok: boolean;
    if (Qc.type === 'count') {
      const { n, k, opts } = Qc,
        T = THINGS[n],
        t = n * k;
      ok = opts[i] === t;
      btns.forEach((b, j) => {
        b.disabled = true;
        const r = opts[j] === t;
        b.classList.add(r ? 'right' : 'wrong');
        b.querySelector('.qc')!.textContent = r ? '✓' : '✗';
      });
      renderGroups(qPic, { count: k, n, theme: T, totals: k });
      const sum = `${addStr(n, k)} = ${t}`;
      qFb.textContent = (ok ? '🎉 Yes! ' : `Let’s count by ${n}s: `) + sum;
      say(
        ok
          ? `Yes! ${sum.replace(/\+/g, 'plus').replace('=', 'makes')}.`
          : `Let's count by ${n}s. ${Array.from({ length: k }, (_, j) => (j + 1) * n).join(', ')}. ${t} ${T.as}.`,
      );
    } else {
      const { a, b, opts } = Qc,
        t = a * b;
      ok = opts[i][0] === a && opts[i][1] === b;
      btns.forEach((btn, j) => {
        btn.disabled = true;
        const [g, n] = opts[j],
          r = g === a && n === b;
        btn.classList.add(r ? 'right' : 'wrong');
        btn.querySelector('.qc')!.textContent = `${groupsText(g, n)} ${r ? '✓' : '✗'}`;
      });
      qFb.textContent = ok ? `🎉 Yes! ${groupsText(a, b)}: ${addStr(b, a)} = ${t}` : `${a} × ${b} means ${groupsText(a, b)}.`;
      say(ok ? `Yes! ${groupsText(a, b)}.` : `Not that one. ${a} times ${b} means ${a} groups, with ${b} in each group.`);
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
