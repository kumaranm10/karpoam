/**
 * Widget "place-value": tens and ones with ice-cream sticks.
 * A bundle of 10 sticks with a rubber band is 1 ten; a loose stick is 1 one. Opening a bundle never changes the number.
 * params: { "target": 74 }  (the number built in the story; default 74, must be 21–99 with a non-zero ones digit)
 */
import './place-value.css';
import { h, step, rnd, shuffle, uniq, plural } from '../lib/dom';
import { speak, say } from '../lib/voice';
import { ding, buzz, cheer, snap, pop } from '../lib/sfx';
import { storyPlayer } from '../lib/story';
import type { Mount } from './registry';

type Tracked = HTMLElement & { _t?: number; _o?: number };
const STICKS10 = '<i class="stk"></i>'.repeat(10);

function renderPV(el: Tracked, t: number, o: number, opts: { tap?: (i: number) => void; mini?: boolean; quiet?: boolean } = {}) {
  const pt = opts.quiet ? t : el._t ?? 0, po = opts.quiet ? o : el._o ?? 0;
  const wrap = h('div', { class: 'pv' + (opts.mini ? ' pv-mini' : '') });
  const zt = h('div', { class: 'pv-zone' }), zo = h('div', { class: 'pv-zone' });
  const it = h('div', { class: 'pv-items', 'aria-hidden': 'true' }), io = h('div', { class: 'pv-items', 'aria-hidden': 'true' });
  for (let i = 0; i < t; i++) {
    const b = document.createElement(opts.tap ? 'button' : 'div');
    b.className = 'bundle' + (i >= pt ? ' new' : '');
    b.innerHTML = STICKS10 + '<span class="band"></span>';
    if (opts.tap) { (b as HTMLButtonElement).type = 'button'; b.setAttribute('aria-label', 'Open this bundle'); b.addEventListener('click', () => opts.tap!(i)); }
    it.append(b);
  }
  for (let k = 0; k < o; k += 5) {
    const five = h('div', { class: 'five' });
    for (let j = k; j < Math.min(o, k + 5); j++) five.append(h('i', { class: 'stk' + (j >= po ? ' new' : '') }));
    io.append(five);
  }
  zt.append(it, h('div', { class: 'pv-lbl' }, `<b>${t}</b> ${t === 1 ? 'bundle' : 'bundles'} = <b>${t * 10}</b>`));
  zo.append(io, h('div', { class: 'pv-lbl' }, `<b>${o}</b> ${o === 1 ? 'stick' : 'sticks'} = <b>${o}</b>`));
  wrap.append(zt, zo);
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', `${plural(t, 'bundle')} of ten and ${plural(o, 'loose stick')}`);
  el.innerHTML = ''; el.append(wrap);
  el._t = t; el._o = o;
}

const words = (t: number, o: number) => `${plural(t, 'ten')} and ${plural(o, 'one')}`;
function sumHTML(t: number, o: number, glow = false) {
  const n = t * 10 + o;
  const big = t > 0 && o < 10 ? `<span class="t">${t}</span><span class="o">${o}</span>` : String(n);
  return `<div class="pv-eq"><span class="t">${words(t, o).split(' and ')[0]}</span> and <span class="o">${plural(o, 'one')}</span></div>
    <div class="pv-eq">${t * 10} + ${o} = <span class="big-num pv-big${glow ? ' glow' : ''}">${big}</span></div>`;
}

const mount: Mount = (root, params) => {
  let target = Number(params.target ?? 74);
  if (!(target >= 21 && target <= 99 && target % 10 !== 0)) target = 74;
  const T = Math.floor(target / 10), O = target % 10;

  /* ---------- 1. See ---------- */
  const s1 = step(root, 1, 'See: bundles of ten');
  const sc = h('div', { class: 'scene' });
  const sSay = h('div', { class: 'say', 'aria-live': 'polite' });
  const sPV = h('div', { style: 'width:100%' }) as Tracked;
  const sSum = h('div', { class: 'pv-sum' });
  sc.append(sSay, sPV, sSum); s1.append(sc);
  const show = (t: number, o: number, sum = true, tap?: (i: number) => void) => { renderPV(sPV, t, o, { tap }); sSum.innerHTML = sum ? sumHTML(t, o) : ''; };
  let st = { t: T - 1, o: O + 10 };
  const story = storyPlayer(s1, sSay, [
    {
      text: 'This is <b>one</b> ice-cream stick.',
      enter: () => { sPV._t = 0; sPV._o = 0; show(0, 1, false); },
      play: async () => { await speak('This is one ice cream stick. One stick is one.'); },
    },
    {
      text: 'Let’s count sticks, all the way to <b>10</b>.',
      enter: () => show(0, 10, false),
      play: async (alive) => {
        sPV._o = 0; show(0, 1, false); await speak('Let’s count sticks, all the way to ten. One.'); if (!alive()) return;
        for (let n = 2; n <= 10; n++) { show(0, n, false); pop(); await speak(String(n)); if (!alive()) return; }
        await speak('Ten sticks!');
      },
    },
    {
      text: 'Put a rubber band around 10 sticks. Now it is <b>1 ten</b>!',
      enter: () => show(1, 0),
      play: async (alive) => {
        sPV._o = 10; sPV._t = 0; show(0, 10, false); await speak('Put a rubber band around ten sticks.'); if (!alive()) return;
        show(1, 0); snap(); await speak('Now it is one bundle. One bundle is ten sticks. We call it one ten.');
      },
    },
    {
      text: `Let’s make <b>${target}</b>. Count the bundles by tens.`,
      enter: () => show(T, O),
      play: async (alive) => {
        sPV._t = 0; sPV._o = 0; show(0, 0, false);
        await speak(`Let’s make ${target}. Count the bundles by tens.`); if (!alive()) return;
        for (let i = 1; i <= T; i++) { show(i, 0, false); pop(); await speak(String(i * 10)); if (!alive()) return; }
        await speak('Now the loose sticks.'); if (!alive()) return;
        for (let k = 1; k <= O; k++) { show(T, k, false); pop(); await speak(String(T * 10 + k)); if (!alive()) return; }
        show(T, O); await speak(`${words(T, O)} make ${target}.`);
      },
    },
    {
      text: `In ${target}, the <b class="pv-big"><span class="t">${T}</span></b> counts bundles. The <b class="pv-big"><span class="o">${O}</span></b> counts sticks.`,
      enter: () => { renderPV(sPV, T, O, { quiet: true }); sSum.innerHTML = sumHTML(T, O, true); },
      play: async () => { await speak(`In ${target}, the ${T} tells us how many bundles. The ${O} tells us how many loose sticks.`); },
    },
    {
      text: 'Snap the band off <b>one bundle</b>!',
      enter: () => { renderPV(sPV, T, O, { quiet: true }); sSum.innerHTML = sumHTML(T, O); },
      play: async (alive) => {
        await speak('Snap the band off one bundle!'); if (!alive()) return;
        sPV.querySelector('.bundle:last-child')?.classList.add('shake');
        await new Promise((r) => setTimeout(r, 500)); if (!alive()) return;
        show(T - 1, O + 10); snap();
        await speak(`Ten sticks fall out. Now there are ${T - 1} bundles and ${O + 10} sticks.`); if (!alive()) return;
        await speak(`${(T - 1) * 10} and ${O + 10} make ${target}. Still ${target}!`);
      },
    },
    {
      text: 'Your turn! <b>Tap a bundle</b> to open it.',
      enter: () => { st = { t: T - 1, o: O + 10 }; renderPV(sPV, st.t, st.o, { tap: openTap, quiet: true }); sSum.innerHTML = sumHTML(st.t, st.o); },
      play: async () => { await speak('Your turn! Tap a bundle to open it.'); },
    },
  ]);
  function openTap() {
    if (!story.isOn(6) || st.t <= 0 || st.o > 34) return;
    st = { t: st.t - 1, o: st.o + 10 }; snap();
    renderPV(sPV, st.t, st.o, { tap: openTap }); sSum.innerHTML = sumHTML(st.t, st.o);
    story.setText(`<span class="party">🎉</span>&nbsp;${words(st.t, st.o)}. Still ${target}!`);
    cheer();
    say(`${words(st.t, st.o)}. ${st.t * 10} and ${st.o} make ${target}. Still ${target}!`);
  }

  /* ---------- 2. Try ---------- */
  const s2 = step(root, 2, 'Try: make the number');
  const chal = h('div', { class: 'chal' });
  const steppers = h('div', { class: 'steppers' }, `
    <div class="stepper"><span class="lbl">Bundles (tens)</span><div class="row"><button class="rb" type="button" data-a="t-" aria-label="One less bundle">−</button><span class="val" data-v="t"></span><button class="rb" type="button" data-a="t+" aria-label="One more bundle">+</button></div></div>
    <div class="stepper"><span class="lbl">Sticks (ones)</span><div class="row"><button class="rb o" type="button" data-a="o-" aria-label="One less stick">−</button><span class="val" data-v="o"></span><button class="rb o" type="button" data-a="o+" aria-label="One more stick">+</button></div></div>`);
  const sc2 = h('div', { class: 'scene' });
  const tPV = h('div', { style: 'width:100%' }) as Tracked;
  const tSum = h('div', { class: 'pv-sum' });
  sc2.append(tPV, tSum);
  const bOpen = h('button', { class: 'btn', type: 'button' }, '✂️ Open a bundle');
  const bBand = h('button', { class: 'btn', type: 'button' }, '🔵 Band 10 sticks');
  const bNew = h('button', { class: 'btn', type: 'button' }, 'New challenge');
  const ctl2 = h('div', { class: 'ctl' }); ctl2.append(bOpen, bBand, bNew);
  s2.append(chal, steppers, sc2, ctl2);
  const CH = [{ n: 23 }, { n: 40 }, { n: target, tens: T - 1 }, { n: 35 }, { n: 58 }, { n: 61, tens: 5 }, { n: 17 }, { n: 92 }];
  let ci = 0, tt = 0, to = 0, won = false;
  const q = (s: string) => steppers.querySelector(s) as HTMLElement;
  function drawT(talk: boolean, msg?: string) {
    q('[data-v="t"]').textContent = String(tt); q('[data-v="o"]').textContent = String(to);
    (q('[data-a="t-"]') as HTMLButtonElement).disabled = tt <= 0; (q('[data-a="t+"]') as HTMLButtonElement).disabled = tt >= 9;
    (q('[data-a="o-"]') as HTMLButtonElement).disabled = to <= 0; (q('[data-a="o+"]') as HTMLButtonElement).disabled = to >= 29;
    bOpen.disabled = tt <= 0 || to > 19; bBand.disabled = to < 10 || tt >= 9;
    renderPV(tPV, tt, to); tSum.innerHTML = sumHTML(tt, to);
    const c = CH[ci], n = tt * 10 + to, hit = n === c.n && (c.tens === undefined || tt === c.tens);
    if (hit && !won) { won = true; cheer(); }
    chal.className = 'chal' + (hit ? ' won' : '');
    const ask = c.tens === undefined ? `Can you make <b>${c.n}</b>?` : `Can you make <b>${c.n}</b> with only <b>${c.tens} bundles</b>?`;
    chal.innerHTML = hit ? `🎉 Yes! ${words(tt, to)} make ${c.n}.` : ask;
    if (talk) say(hit ? `Yes! ${words(tt, to)} make ${c.n}!` : msg ?? `${words(tt, to)} make ${n}.`);
  }
  steppers.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.a;
    if (a === 't-' && tt > 0) tt--; else if (a === 't+' && tt < 9) tt++;
    else if (a === 'o-' && to > 0) to--; else if (a === 'o+' && to < 29) to++; else return;
    pop(); drawT(true);
  });
  bOpen.addEventListener('click', () => { if (tt > 0 && to <= 19) { tt--; to += 10; snap(); drawT(true, `You opened a bundle. ${words(tt, to)}. Still ${tt * 10 + to}!`); } });
  bBand.addEventListener('click', () => { if (to >= 10 && tt < 9) { tt++; to -= 10; snap(); drawT(true, `Ten sticks make a bundle. ${words(tt, to)}. Still ${tt * 10 + to}!`); } });
  bNew.addEventListener('click', () => {
    ci = (ci + 1) % CH.length; won = false; drawT(false);
    const c = CH[ci];
    say(c.tens === undefined ? `Can you make ${c.n}?` : `Can you make ${c.n} with only ${c.tens} bundles?`);
  });
  drawT(false);

  /* ---------- 3. Check ---------- */
  const s3 = step(root, 3, 'Check: picture quiz');
  const qText = h('div', { class: 'qtext' });
  const qPic = h('div', { style: 'width:100%;display:flex;justify-content:center' }) as Tracked;
  const qOpts = h('div', { class: 'qopts' });
  const qFb = h('div', { class: 'qfb', 'aria-live': 'polite' });
  const qScore = h('span', { class: 'score' }, '0 of 0 right');
  const qNext = h('button', { class: 'btn go', type: 'button' }, 'Next question');
  const ctl3 = h('div', { class: 'ctl' }); ctl3.append(qScore, qNext);
  s3.append(qText, qPic, qOpts, qFb, ctl3);

  type Q =
    | { type: 'count'; t: number; o: number; opts: number[] }
    | { type: 'money'; t: number; o: number; opts: number[] }
    | { type: 'which'; n: number; opts: [number, number][] };
  let right = 0, asked = 0, first = true, touched = false, Qc: Q;
  const numDistract = (t: number, o: number) => {
    const n = t * 10 + o, c = [t + o, n + 10, n - 10];
    if (o < 10 && o > 0 && o !== t) c.unshift(o * 10 + t);
    if (o >= 10) c.unshift(Number(`${t}${o}`));
    return uniq(c.filter((v) => v > 0 && v !== n)).slice(0, 2);
  };
  function makeQ(): Q {
    if (first) { first = false; return { type: 'which', n: target, opts: shuffle([[T - 1, O + 10], [T - 1, O], [T, 10]]) }; }
    const r = Math.random();
    if (r < 0.4) {
      const t = rnd(1, 8), o = Math.random() < 0.35 ? rnd(10, 16) : rnd(0, 9);
      return { type: 'count', t, o, opts: shuffle([t * 10 + o, ...numDistract(t, o)]) };
    }
    if (r < 0.7) {
      const t = rnd(1, 6), o = rnd(1, 9);
      return { type: 'money', t, o, opts: shuffle([t * 10 + o, ...numDistract(t, o)]) };
    }
    const t = rnd(3, 8), o = rnd(1, 8), n = t * 10 + o;
    const good: [number, number] = Math.random() < 0.6 ? [t - 1, o + 10] : [t, o];
    const pool: [number, number][] = shuffle([[t - 1, o], [t, o + 10], [t - 1, o + 1], [t + 1, o], [o, t]]);
    const bad = pool.filter(([a, b]) => a >= 0 && b <= 19 && a * 10 + b !== n && !(a === good[0] && b === good[1])).slice(0, 2);
    return { type: 'which', n, opts: shuffle([good, ...bad]) };
  }
  const moneyHTML = (t: number, o: number) =>
    `<div class="money" role="img" aria-label="${plural(t, 'ten-dollar note')} and ${plural(o, 'one-dollar coin')}">${'<span class="note10">$10</span>'.repeat(t)}${'<span class="coin1">$1</span>'.repeat(o)}</div>`;
  function newQ() {
    Qc = makeQ(); qFb.textContent = ''; qFb.className = 'qfb'; qOpts.innerHTML = ''; qPic.innerHTML = ''; qPic._t = undefined;
    if (Qc.type === 'which') {
      const n = Qc.n;
      qText.innerHTML = `Which one makes <b>${n}</b>?`;
      Qc.opts.forEach(([t, o], i) => {
        const b = h('button', { class: 'qopt', type: 'button', 'aria-label': words(t, o) });
        const pic = h('div') as Tracked; renderPV(pic, t, o, { mini: true, quiet: true });
        b.append(pic, h('span', { class: 'qc' }, words(t, o)));
        b.addEventListener('click', () => answer(i)); qOpts.append(b);
      });
      if (touched) say(`Which one makes ${n}?`);
      return;
    }
    const { t, o } = Qc;
    if (Qc.type === 'count') { qText.innerHTML = 'How many sticks?'; renderPV(qPic, t, o, { quiet: true }); if (touched) say('How many sticks?'); }
    else { qText.innerHTML = 'How much money?'; qPic.innerHTML = moneyHTML(t, o); if (touched) say('How much money? Each red note is ten dollars. Each coin is one dollar.'); }
    Qc.opts.forEach((v, i) => {
      const b = h('button', { class: 'qopt', type: 'button' }, `${Qc.type === 'money' ? '$' : ''}${v}<span class="qc"></span>`);
      b.addEventListener('click', () => answer(i)); qOpts.append(b);
    });
  }
  function answer(i: number) {
    touched = true; asked++;
    const btns = [...qOpts.children] as HTMLButtonElement[];
    let ok: boolean;
    if (Qc.type === 'which') {
      const { n, opts } = Qc; ok = opts[i][0] * 10 + opts[i][1] === n;
      btns.forEach((b, j) => {
        b.disabled = true; const [t, o] = opts[j], v = t * 10 + o, r = v === n;
        b.classList.add(r ? 'right' : 'wrong'); b.querySelector('.qc')!.textContent = `${t * 10} + ${o} = ${v} ${r ? '✓' : '✗'}`;
      });
      const [t, o] = opts.find(([a, b]) => a * 10 + b === n)!;
      qFb.textContent = (ok ? '🎉 Yes! ' : 'This one: ') + `${words(t, o)} = ${t * 10} + ${o} = ${n}`;
      say(ok ? `Yes! ${words(t, o)}. ${t * 10} and ${o} make ${n}.` : `Count the bundles by tens, then add the sticks. ${words(t, o)} make ${n}.`);
    } else {
      const { t, o, opts } = Qc, n = t * 10 + o, unit = Qc.type === 'money' ? '$' : ''; ok = opts[i] === n;
      btns.forEach((b, j) => { b.disabled = true; const r = opts[j] === n; b.classList.add(r ? 'right' : 'wrong'); b.querySelector('.qc')!.textContent = r ? '✓' : '✗'; });
      qFb.textContent = (ok ? '🎉 Yes! ' : 'Count by tens first: ') + `${unit}${t * 10} + ${unit}${o} = ${unit}${n}`;
      const tens = Array.from({ length: t }, (_, k) => (k + 1) * 10).join(', ');
      say(ok ? `Yes! ${n}${unit ? ' dollars' : ''}.` : `Count by tens first. ${tens}. Then add ${o}. ${n}${unit ? ' dollars' : ''}.`);
    }
    if (ok) { right++; ding(); } else buzz();
    qFb.className = 'qfb ' + (ok ? 'ok' : 'no');
    qScore.textContent = `${right} of ${asked} right`;
  }
  qNext.addEventListener('click', () => { touched = true; newQ(); });
  newQ();
};
export default mount;
