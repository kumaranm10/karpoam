/**
 * Widget "sort": put each picture in the right basket. Works for any subject; everything comes from params.
 *
 * params:
 *   bins:  [{ id, label, icon, pick }]       2 or 3 baskets. `pick` = check-question text, e.g. "Tap the living thing."
 *   ask:   "Is a {name} living or non-living?"  try-question; {name} is replaced
 *   clues: [{ icon, text }]                   optional reminders shown in the story (e.g. "eats", "grows")
 *   intro: { text, say }                      first story screen
 *   story: [{ item, text, say, clues: [true,false,…] }]   one screen per example; item must be an id in items
 *   items: [{ id, icon, name, bin, why, audio? }]         all pictures; `why` is read after each answer
 *   seeTitle, tryTitle, checkTitle            optional step titles
 */
import './sort.css';
import { esc, h, rnd, shuffle, step } from '../lib/dom';
import { buzz, cheer, ding } from '../lib/sfx';
import { storyPlayer } from '../lib/story';
import { say, speak } from '../lib/voice';
import type { Mount } from './registry';

interface Bin {
  id: string;
  label: string;
  icon: string;
  pick: string;
}
interface Item {
  id: string;
  icon: string;
  name: string;
  bin: string;
  why: string;
  audio?: string;
}
interface StoryStep {
  item: string;
  text: string;
  say?: string;
  clues?: boolean[];
}

const mount: Mount = (root, p, ctx) => {
  const bins = p.bins as Bin[],
    items = p.items as Item[],
    clues = (p.clues ?? []) as { icon: string; text: string }[];
  const byId = new Map(items.map((i) => [i.id, i]));
  const binOf = (id: string) => bins.find((b) => b.id === id)!;
  const lang = ctx.lang;
  const talk = (text: string, audio?: string) => speak(text, { lang, audio });
  const ask = (it: Item) => String(p.ask ?? 'Where does the {name} go?').replace('{name}', it.name);
  const plain = (html: string) => html.replace(/<[^>]+>/g, '');

  const card = (it: Item, cls = '') =>
    `<div class="so-card ${cls}"><span class="so-icon" aria-hidden="true">${it.icon}</span><span class="so-name">${esc(it.name)}</span></div>`;
  const clueRow = (marks?: boolean[]) =>
    clues.length
      ? `<div class="so-clues">${clues
          .map((c, i) => {
            const m = marks?.[i];
            const cls = m === undefined ? '' : m ? 'yes' : 'no';
            return `<span class="so-clue ${cls}"><span aria-hidden="true">${c.icon}</span>${esc(c.text)}${m === undefined ? '' : `<span class="m">${m ? '✓' : '✗'}</span>`}</span>`;
          })
          .join('')}</div>`
      : '';
  const binsHTML = (got: Record<string, string[]>, asButtons = false) =>
    `<div class="so-bins" style="--bins:${bins.length}">${bins
      .map((b) => {
        const tag = asButtons ? 'button' : 'div';
        return `<${tag} class="so-bin" ${asButtons ? `type="button" data-bin="${b.id}"` : ''}>
        <span class="so-bin-head"><span class="bi" aria-hidden="true">${b.icon}</span>${esc(b.label)}</span>
        <span class="so-got" aria-hidden="true">${(got[b.id] ?? []).map((ic) => `<span>${ic}</span>`).join('')}</span></${tag}>`;
      })
      .join('')}</div>`;
  const empty = () => Object.fromEntries(bins.map((b) => [b.id, [] as string[]]));

  /* ---------- 1. See ---------- */
  const s1 = step(root, 1, String(p.seeTitle ?? 'See'));
  const sc = h('div', { class: 'scene' });
  const sSay = h('div', { class: 'say', 'aria-live': 'polite' });
  const sBody = h('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:16px;width:100%' });
  sc.append(sSay, sBody);
  s1.append(sc);
  const storySteps = (p.story ?? []) as StoryStep[];
  const gotUpTo = (n: number) => {
    const g = empty();
    storySteps.slice(0, n).forEach((s) => {
      const it = byId.get(s.item);
      if (it) g[it.bin].push(it.icon);
    });
    return g;
  };
  const steps = [
    {
      text: String(p.intro?.text ?? 'Let’s sort!'),
      enter: () => {
        sBody.innerHTML = clueRow() + binsHTML(empty());
      },
      play: async () => {
        await talk(String(p.intro?.say ?? plain(String(p.intro?.text ?? ''))));
      },
    },
    ...storySteps.map((s, n) => {
      const it = byId.get(s.item)!;
      return {
        text: s.text,
        enter: () => {
          sBody.innerHTML = card(it, 'in') + clueRow(s.clues) + binsHTML(gotUpTo(n + 1));
        },
        play: async () => {
          await talk(s.say ?? plain(s.text), it.audio);
        },
      };
    }),
    {
      text: 'Your turn! Sort the pictures below. 👇',
      enter: () => {
        sBody.innerHTML = binsHTML(gotUpTo(storySteps.length));
      },
      play: async () => {
        await talk('Your turn! Sort the pictures below.');
      },
    },
  ];
  storyPlayer(s1, sSay, steps);

  /* ---------- 2. Try ---------- */
  const s2 = step(root, 2, String(p.tryTitle ?? 'Try: sort them'));
  const sc2 = h('div', { class: 'scene' });
  const tAsk = h('div', { class: 'say', 'aria-live': 'polite' });
  const tCard = h('div');
  const tBins = h('div', { style: 'width:100%' });
  const tProg = h('div', { class: 'so-progress' });
  sc2.append(tAsk, tCard, tBins, tProg);
  const again = h('button', { class: 'btn', type: 'button' }, '↺ Play again');
  const ctl2 = h('div', { class: 'ctl' });
  ctl2.append(again);
  s2.append(sc2, ctl2);
  let deck: Item[] = [],
    idx = 0,
    got = empty(),
    started = false,
    locked = false;
  function drawTry() {
    tBins.innerHTML = binsHTML(got, idx < deck.length);
    tProg.textContent = `${Math.min(idx, deck.length)} of ${deck.length} sorted`;
    if (idx >= deck.length) {
      tAsk.innerHTML = '<span class="party">🎉</span>&nbsp;All sorted. Well done!';
      tCard.innerHTML = '';
      return;
    }
    const it = deck[idx];
    tAsk.textContent = ask(it);
    tCard.innerHTML = card(it, 'in');
  }
  tBins.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-bin]') as HTMLButtonElement | null;
    if (!btn || locked || idx >= deck.length) return;
    started = true;
    const it = deck[idx];
    if (btn.dataset.bin === it.bin) {
      locked = true;
      btn.classList.add('good');
      ding();
      got[it.bin].push(it.icon);
      idx++;
      await talk(`Yes! ${it.why}`);
      locked = false;
      drawTry();
      if (idx >= deck.length) {
        cheer();
        say('All sorted. Well done!', { lang });
      } else if (started) say(ask(deck[idx]), { lang, audio: deck[idx].audio });
    } else {
      btn.classList.add('bad');
      buzz();
      say(`Not quite. ${it.why}`, { lang });
      setTimeout(() => btn.classList.remove('bad'), 600);
    }
  });
  function restart() {
    deck = shuffle([...items]);
    idx = 0;
    got = empty();
    locked = false;
    drawTry();
  }
  again.addEventListener('click', () => {
    restart();
    say(ask(deck[0]), { lang, audio: deck[0].audio });
  });
  restart();

  /* ---------- 3. Check ---------- */
  const s3 = step(root, 3, String(p.checkTitle ?? 'Check: picture quiz'));
  const qText = h('div', { class: 'qtext' });
  const qOpts = h('div', { class: 'qopts' });
  const qFb = h('div', { class: 'qfb', 'aria-live': 'polite' });
  const qScore = h('span', { class: 'score' }, '0 of 0 right');
  const qNext = h('button', { class: 'btn go', type: 'button' }, 'Next question');
  const ctl3 = h('div', { class: 'ctl' });
  ctl3.append(qScore, qNext);
  s3.append(qText, qOpts, qFb, ctl3);
  let right = 0,
    asked = 0,
    touched = false,
    target: Bin,
    opts: Item[] = [];
  function newQ() {
    target = bins[rnd(0, bins.length - 1)];
    const yes = shuffle(items.filter((i) => i.bin === target.id))[0];
    const no = shuffle(items.filter((i) => i.bin !== target.id)).slice(0, 2);
    opts = shuffle([yes, ...no]);
    qText.textContent = target.pick;
    qFb.textContent = '';
    qFb.className = 'qfb';
    qOpts.innerHTML = '';
    opts.forEach((it, i) => {
      const b = h(
        'button',
        { class: 'qopt', type: 'button', 'aria-label': it.name },
        `<span class="so-icon" aria-hidden="true">${it.icon}</span><span class="qc">${esc(it.name)}</span>`,
      );
      b.addEventListener('click', () => answer(i));
      qOpts.append(b);
    });
    if (touched) say(target.pick, { lang });
  }
  function answer(i: number) {
    touched = true;
    asked++;
    const pick = opts[i],
      ok = pick.bin === target.id;
    ([...qOpts.children] as HTMLButtonElement[]).forEach((b, j) => {
      b.disabled = true;
      const r = opts[j].bin === target.id;
      b.classList.add(r ? 'right' : 'wrong');
      b.querySelector('.qc')!.textContent = `${opts[j].name} ${r ? '✓' : '✗'}`;
    });
    const correct = opts.find((o) => o.bin === target.id)!;
    qFb.textContent = ok ? `🎉 Yes! ${correct.why}` : `${pick.why} Look at the ${correct.name}.`;
    say(ok ? `Yes! ${correct.why}` : `Not quite. ${pick.why}`, { lang });
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
  void binOf;
};
export default mount;
