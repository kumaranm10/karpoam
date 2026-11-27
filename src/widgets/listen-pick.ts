/**
 * Widget "listen-pick": hear a word or sound, then tap the matching picture or letter (3–4 choices).
 * Works for any language. For Tamil (`lang: ta`) give each item an `audio` MP3; it plays first.
 * Without sound (sound off), the word is shown as a hint straight away; with sound, after one wrong try.
 *
 * params:
 *   items:   [{ id, icon, name, say?, audio?, why?, whyAudio? }]   ≥ 4 things to hear. `icon` = picture emoji or a letter.
 *            `name` = the word (hint + feedback). `say` = what the voice reads (default `name`). `why` = short reason after a quiz answer.
 *   choices: 3 or 4 pictures per question (default 4, never more than the number of items)
 *   intro:   { text, say, audio? }                       first story screen (optional)
 *   story:   [{ item, text, say?, audio? }]              one screen per example (default: the first 3 items)
 *   ask:     try-question text (default "Listen. Tap the one you hear.")
 *   quiz:    check-question text (default "Which one did you hear?")
 *   seeTitle, tryTitle, checkTitle                       optional step titles
 */
import './listen-pick.css';
import { esc, h, rnd, shuffle, step } from '../lib/dom';
import { buzz, cheer, ding } from '../lib/sfx';
import { storyPlayer } from '../lib/story';
import { onSoundChange, soundOn, speak } from '../lib/voice';
import type { Mount } from './registry';

export interface LpItem {
  id: string;
  icon: string;
  name: string;
  say?: string;
  audio?: string;
  why?: string;
  whyAudio?: string;
}
interface LpStory {
  item: string;
  text: string;
  say?: string;
  audio?: string;
}

/** The pictures for one question: the target plus `n - 1` different others, shuffled. Exactly one is the target. */
export function pickOptions(items: LpItem[], target: LpItem, n: number): LpItem[] {
  const others = shuffle(items.filter((i) => i.id !== target.id)).slice(0, Math.max(0, n - 1));
  return shuffle([target, ...others]);
}

const mount: Mount = (root, p, ctx) => {
  const items = (p.items ?? []) as LpItem[];
  const lang = ctx.lang;
  const byId = new Map(items.map((i) => [i.id, i]));
  const n = Math.max(2, Math.min(Number(p.choices) || 4, 4, items.length));
  const askText = String(p.ask ?? 'Listen. Tap the one you hear.');
  const quizText = String(p.quiz ?? 'Which one did you hear?');
  /** Caption → text for the voice (never put back into HTML). Drops tags, then any stray < or >. */
  const plain = (html: string) => html.replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
  /** Play the item's own word (its MP3 first, else the voice). */
  const hear = (it: LpItem) => speak(it.say ?? it.name, { lang, audio: it.audio });
  const pic = (it: LpItem) => `<span class="lp-icon" aria-hidden="true">${it.icon}</span>`;

  /* ---------- 1. See ---------- */
  const s1 = step(root, 1, String(p.seeTitle ?? 'See: listen'));
  const sc = h('div', { class: 'scene' });
  const sSay = h('div', { class: 'say', 'aria-live': 'polite' });
  const sBody = h('div', { class: 'lp-body' });
  sc.append(sSay, sBody);
  s1.append(sc);
  const story: LpStory[] = Array.isArray(p.story)
    ? (p.story as LpStory[]).filter((s) => byId.has(s.item))
    : items.slice(0, 3).map((it) => ({ item: it.id, text: `<b>${esc(it.name)}</b>` }));
  const row = (upTo: number) =>
    `<div class="lp-row">${story
      .slice(0, upTo)
      .map((s) => pic(byId.get(s.item)!))
      .join('')}</div>`;
  storyPlayer(s1, sSay, [
    {
      text: String(p.intro?.text ?? 'Listen to each word.'),
      enter: () => {
        sBody.innerHTML = `<div class="lp-card lp-ear"><span class="lp-icon" aria-hidden="true">👂</span></div>`;
      },
      play: async () => {
        await speak(String(p.intro?.say ?? plain(String(p.intro?.text ?? 'Listen to each word.'))), { lang, audio: p.intro?.audio });
      },
    },
    ...story.map((s, k) => {
      const it = byId.get(s.item)!;
      return {
        text: s.text,
        enter: () => {
          sBody.innerHTML = `<div class="lp-card in">${pic(it)}<span class="lp-name">${esc(it.name)}</span></div>${row(k)}`;
        },
        play: async (alive: () => boolean) => {
          if (s.say || s.audio) {
            await speak(s.say ?? plain(s.text), { lang, audio: s.audio });
            if (!alive()) return;
          }
          await hear(it);
        },
      };
    }),
    {
      text: 'Your turn! Listen and tap. 👇',
      enter: () => {
        sBody.innerHTML = row(story.length);
      },
      play: async () => {
        await speak('Your turn! Listen and tap.', { lang: 'en' });
      },
    },
  ]);

  /* ---------- 2. Try ---------- */
  const s2 = step(root, 2, String(p.tryTitle ?? 'Try: listen and tap'));
  const sc2 = h('div', { class: 'scene' });
  const tAsk = h('div', { class: 'say', 'aria-live': 'polite' }, esc(askText));
  const tHint = h('div', { class: 'lp-hint', 'aria-live': 'polite' });
  const tOpts = h('div', { class: 'lp-opts' });
  const tProg = h('div', { class: 'lp-progress' });
  sc2.append(tAsk, tHint, tOpts, tProg);
  const play2 = h('button', { class: 'btn go', type: 'button' }, '🔊 Play again');
  const restartBtn = h('button', { class: 'btn', type: 'button' }, '↺ New game');
  const ctl2 = h('div', { class: 'ctl' });
  ctl2.append(play2, restartBtn);
  s2.append(sc2, ctl2);
  let deck: LpItem[] = [],
    idx = 0,
    opts: LpItem[] = [],
    locked = false,
    started = false;
  const showHint = (el: HTMLElement, it: LpItem | undefined, show: boolean) => {
    el.textContent = it && show ? it.name : '';
    el.classList.toggle('on', Boolean(it && show));
  };
  function drawTry() {
    tProg.textContent = `${Math.min(idx, deck.length)} of ${deck.length} found`;
    if (idx >= deck.length) {
      tAsk.innerHTML = '<span class="party">🎉</span>&nbsp;All found. Well done!';
      tOpts.innerHTML = '';
      showHint(tHint, undefined, false);
      play2.disabled = true;
      return;
    }
    play2.disabled = false;
    const target = deck[idx];
    opts = pickOptions(items, target, n);
    tAsk.textContent = askText;
    showHint(tHint, target, !soundOn());
    tOpts.innerHTML = '';
    opts.forEach((it, i) => {
      const b = h('button', { class: 'lp-opt', type: 'button', 'aria-label': it.name, 'data-i': i }, pic(it));
      tOpts.append(b);
    });
  }
  tOpts.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest('button.lp-opt') as HTMLButtonElement | null;
    if (!b || locked || idx >= deck.length) return;
    started = true;
    const target = deck[idx],
      pick = opts[Number(b.dataset.i)];
    if (pick.id === target.id) {
      locked = true;
      b.classList.add('good');
      ding();
      tAsk.innerHTML = `🎉 Yes! <b>${esc(target.name)}</b>`;
      await hear(target);
      idx++;
      locked = false;
      drawTry();
      if (idx >= deck.length) {
        cheer();
        void speak('All found. Well done!', { lang: 'en' });
      } else void hear(deck[idx]);
    } else {
      b.classList.add('bad');
      b.disabled = true;
      buzz();
      tAsk.innerHTML = `Not quite. That is <b>${esc(pick.name)}</b>.`;
      showHint(tHint, target, true);
      void hear(pick);
    }
  });
  function restart() {
    deck = shuffle([...items]);
    idx = 0;
    locked = false;
    drawTry();
  }
  play2.addEventListener('click', () => {
    started = true;
    if (idx < deck.length) void hear(deck[idx]);
  });
  restartBtn.addEventListener('click', () => {
    restart();
    if (started) void hear(deck[0]);
  });
  restart();

  /* ---------- 3. Check ---------- */
  const s3 = step(root, 3, String(p.checkTitle ?? 'Check: listening quiz'));
  const qText = h('div', { class: 'qtext' }, esc(quizText));
  const qHint = h('div', { class: 'lp-hint', 'aria-live': 'polite' });
  const qOpts = h('div', { class: 'qopts lp-qopts' });
  const qFb = h('div', { class: 'qfb', 'aria-live': 'polite' });
  const qScore = h('span', { class: 'score' }, '0 of 0 right');
  const qPlay = h('button', { class: 'btn', type: 'button' }, '🔊 Play again');
  const qNext = h('button', { class: 'btn go', type: 'button' }, 'Next question');
  const ctl3 = h('div', { class: 'ctl' });
  ctl3.append(qScore, qPlay, qNext);
  s3.append(qText, qHint, qOpts, qFb, ctl3);
  let right = 0,
    asked = 0,
    touched = false,
    target: LpItem = items[0],
    qChoices: LpItem[] = [];
  function newQ() {
    const pool = items.length > 1 ? items.filter((i) => i !== target) : items;
    target = pool[rnd(0, pool.length - 1)];
    qChoices = pickOptions(items, target, n);
    qFb.textContent = '';
    qFb.className = 'qfb';
    showHint(qHint, target, !soundOn());
    qOpts.innerHTML = '';
    qChoices.forEach((it, i) => {
      const b = h('button', { class: 'qopt lp-opt', type: 'button', 'aria-label': it.name }, `${pic(it)}<span class="qc"></span>`);
      b.addEventListener('click', () => answer(i));
      qOpts.append(b);
    });
    if (touched) void hear(target);
  }
  async function answer(i: number) {
    touched = true;
    asked++;
    const pick = qChoices[i],
      ok = pick.id === target.id;
    ([...qOpts.children] as HTMLButtonElement[]).forEach((b, j) => {
      b.disabled = true;
      const r = qChoices[j].id === target.id;
      b.classList.add(r ? 'right' : 'wrong');
      b.querySelector('.qc')!.textContent = `${qChoices[j].name} ${r ? '✓' : '✗'}`;
    });
    const why = target.why ? ` ${target.why}` : '';
    qFb.textContent = ok ? `🎉 Yes! It is ${target.name}.${why}` : `Not quite. You tapped ${pick.name}. You heard ${target.name}.${why}`;
    qFb.className = `qfb ${ok ? 'ok' : 'no'}`;
    if (ok) {
      right++;
      ding();
    } else buzz();
    qScore.textContent = `${right} of ${asked} right`;
    const heard = target;
    await hear(heard);
    if (heard.why && heard === target) await speak(heard.why, { lang, audio: heard.whyAudio });
  }
  qPlay.addEventListener('click', () => {
    touched = true;
    void hear(target);
  });
  qNext.addEventListener('click', () => {
    touched = true;
    newQ();
  });
  newQ();

  /* Sound switched off mid-lesson: show the word so the child can still play by reading. */
  onSoundChange((on) => {
    if (idx < deck.length && !tHint.classList.contains('on') && !on) showHint(tHint, deck[idx], true);
    if (!on && !qHint.classList.contains('on') && !qFb.textContent) showHint(qHint, target, true);
  });
};
export default mount;
