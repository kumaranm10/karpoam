import { describe, expect, it, vi } from 'vitest';
import { storyPlayer } from '../../src/lib/story';
import { btn, click } from './helpers';

function setup() {
  const section = document.createElement('section');
  const say = document.createElement('div');
  section.append(say);
  const entered: number[] = [];
  const alives: (() => boolean)[] = [];
  const steps = [0, 1, 2].map((i) => ({
    text: `Step ${i}`,
    enter: () => entered.push(i),
    play: vi.fn(async (alive: () => boolean) => {
      alives.push(alive);
    }),
  }));
  const player = storyPlayer(section, say, steps);
  return { section, say, steps, entered, alives, player };
}

describe('storyPlayer', () => {
  it('starts on step 0 without playing, Back disabled', () => {
    const { section, say, steps, entered } = setup();
    expect(say.textContent).toBe('Step 0');
    expect(entered).toEqual([0]);
    expect(steps[0].play).not.toHaveBeenCalled();
    expect(btn(section, 'Back')?.disabled).toBe(true);
    expect(btn(section, 'Start')).toBeTruthy();
  });

  it('Start plays step 0, Next moves on, last step offers Start again', () => {
    const { section, say, steps, player } = setup();
    click(btn(section, 'Start'));
    expect(steps[0].play).toHaveBeenCalledOnce();
    click(btn(section, 'Next'));
    expect(say.textContent).toBe('Step 1');
    expect(player.isOn(1)).toBe(true);
    click(btn(section, 'Next'));
    expect(btn(section, 'Start again')).toBeTruthy();
    click(btn(section, 'Start again'));
    expect(say.textContent).toBe('Step 0');
  });

  it('marks old narration as stale so it stops talking', () => {
    const { section, alives } = setup();
    click(btn(section, 'Start'));
    expect(alives[0]()).toBe(true);
    click(btn(section, 'Next'));
    expect(alives[0]()).toBe(false);
    expect(alives[1]()).toBe(true);
  });

  it('shows one dot per step with the current one on', () => {
    const { section } = setup();
    click(btn(section, 'Start'));
    click(btn(section, 'Next'));
    const dots = [...section.querySelectorAll('.dots span')];
    expect(dots).toHaveLength(3);
    expect(dots.map((d) => d.className)).toEqual(['', 'on', '']);
  });

  it('Back and Again work, setText replaces the caption', () => {
    const { section, say, steps, player } = setup();
    click(btn(section, 'Start'));
    click(btn(section, 'Next'));
    click(btn(section, 'Back'));
    expect(say.textContent).toBe('Step 0');
    click(btn(section, 'Again'));
    expect(steps[0].play).toHaveBeenCalledTimes(3);
    player.setText('Done!');
    expect(say.textContent).toBe('Done!');
  });
});
