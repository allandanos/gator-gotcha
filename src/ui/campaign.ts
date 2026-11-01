import { CAMPAIGN } from '../config';
import {
  describeGoal,
  describeStar,
  LEVELS,
  meets,
  starsFor,
  type Level,
  type Stars,
} from '../sim/campaign';
import type { World } from '../sim/types';
import {
  createCampaignProgress,
  isLevelUnlocked,
  isWorldUnlocked,
  nextLevel,
  totalStars,
  type StarMap,
} from './campaignProgress';
import { $ } from './dom';
import { browserStore } from './pendingRuns';
import type { ScreenId } from './screens';

const MAX_STARS = LEVELS.length * 3;

export interface LevelOutcome {
  readonly stars: Stars;
  readonly improved: boolean;
}

interface Handlers {
  readonly show: (id: ScreenId) => void;
  readonly play: (level: Level) => void;
  readonly back: () => void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = cls;
  if (text) node.textContent = text;
  return node;
}

const starText = (n: number): string => '★'.repeat(n) + '☆'.repeat(3 - n);

/** Level select, and the card shown when a level ends. Progress is local only. */
export class CampaignUi {
  private readonly progress = createCampaignProgress(browserStore());
  private readonly worlds = $('#campaign-worlds');
  private current: Level | null = null;

  constructor(private readonly h: Handlers) {
    $('#campaign-back-btn').addEventListener('click', h.back);
    $('#level-retry-btn').addEventListener('click', () => this.current && h.play(this.current));
    $('#level-next-btn').addEventListener('click', () => {
      const next = this.current && nextLevel(this.current.id, this.progress.read());
      if (next) h.play(next);
    });
    $('#level-list-btn').addEventListener('click', () => this.open(this.current?.id));
    document
      .querySelectorAll('[data-max-stars]')
      .forEach((n) => (n.textContent = String(MAX_STARS)));
  }

  totalStars(): number {
    return totalStars(this.progress.read());
  }

  /** Show the level list, focusing `focusId` (or the furthest playable level). */
  open(focusId?: number): void {
    const map = this.progress.read();
    $('#campaign-stars').textContent = String(totalStars(map));
    const playable = LEVELS.filter((l) => isLevelUnlocked(l, map));
    const focus = focusId ?? playable.find((l) => !map[l.id])?.id ?? playable.at(-1)?.id ?? 1;
    this.worlds.replaceChildren(
      ...CAMPAIGN.worlds.map((w, i) => this.renderWorld(i, w.name, w.starsToUnlock, map, focus)),
    );
    this.h.show('campaign');
  }

  private renderWorld(
    index: number,
    name: string,
    gate: number,
    map: StarMap,
    focus: number,
  ): HTMLElement {
    const section = el('section', 'world');
    const open = isWorldUnlocked(index, map);
    section.dataset.world = String(index);
    section.toggleAttribute('data-locked', !open);
    const head = el('header', 'world__head');
    head.append(el('h3', 'world__name', name));
    if (!open)
      head.append(el('p', 'world__lock', `★ ${gate} to unlock · ${gate - totalStars(map)} to go`));
    const grid = el('ol', 'level-grid');
    for (const level of LEVELS.filter((l) => l.world === index)) {
      grid.append(this.renderTile(level, map, level.id === focus));
    }
    section.append(head, grid);
    return section;
  }

  private renderTile(level: Level, map: StarMap, focused: boolean): HTMLLIElement {
    const li = document.createElement('li');
    const unlocked = isLevelUnlocked(level, map);
    const stars = map[level.id] ?? 0;
    const btn = el('button', 'level-tile');
    btn.type = 'button';
    btn.disabled = !unlocked;
    btn.toggleAttribute('data-autofocus', focused && unlocked);
    if (level.rules.night) btn.dataset.night = '';
    btn.append(
      el('span', 'level-tile__num', String(level.id)),
      el('span', 'level-tile__name', level.name),
      el(
        'span',
        'level-tile__goal',
        describeGoal(level.goal) + (level.rules.timeLimit ? ` in ${level.rules.timeLimit} s` : ''),
      ),
      el('span', 'level-tile__stars', unlocked ? starText(stars) : 'Locked'),
    );
    btn.setAttribute(
      'aria-label',
      `Level ${level.id}, ${level.name}: ${describeGoal(level.goal)}. ${unlocked ? `${stars} of 3 stars` : 'Locked'}`,
    );
    btn.addEventListener('click', () => this.h.play(level));
    li.append(btn);
    return li;
  }

  /** Record a finished level and fill the end card. */
  finish(level: Level, world: World): LevelOutcome {
    this.current = level;
    const stars = starsFor(level, world);
    const { before, after } = this.progress.record(level.id, stars);
    const cleared = world.status === 'cleared';
    const worldName = CAMPAIGN.worlds[level.world]?.name ?? '';
    $('#level-eyebrow').textContent = `Level ${level.id} · ${worldName}`;
    const heading = $('#level-heading');
    heading.textContent = cleared
      ? 'Level cleared!'
      : world.status === 'timeUp'
        ? 'Out of time'
        : 'CHOMP!';
    heading.classList.toggle('heading--win', cleared);
    heading.classList.toggle('heading--chomp', !cleared);
    const starList = $('#level-stars');
    starList.setAttribute('aria-label', `${stars} of 3 stars earned`);
    starList
      .querySelectorAll('li')
      .forEach((li, i) => li.toggleAttribute('data-earned', i < stars));
    this.fillChecks(level, world, cleared);
    this.fillUnlock(before, after);

    const next = cleared ? nextLevel(level.id, after) : null;
    const nextBtn = $<HTMLButtonElement>('#level-next-btn');
    nextBtn.hidden = !next;
    nextBtn.toggleAttribute('data-autofocus', Boolean(next));
    $('#level-retry-btn').toggleAttribute('data-autofocus', !next);
    this.h.show('level');
    return { stars, improved: after !== before };
  }

  private fillChecks(level: Level, world: World, cleared: boolean): void {
    const rows: Array<[string, boolean]> = [
      [describeGoal(level.goal), cleared],
      [describeStar(level.star2), cleared && meets(level.star2, world)],
      [describeStar(level.star3), cleared && meets(level.star3, world)],
    ];
    $('#level-checks').replaceChildren(
      ...rows.map(([text, ok]) => {
        const li = el('li', 'level-check', text);
        li.toggleAttribute('data-met', ok);
        return li;
      }),
    );
  }

  private fillUnlock(before: StarMap, after: StarMap): void {
    const opened = CAMPAIGN.worlds.findIndex(
      (_, i) => !isWorldUnlocked(i, before) && isWorldUnlocked(i, after),
    );
    const note = $('#level-unlock');
    note.textContent = opened >= 0 ? `${CAMPAIGN.worlds[opened]?.name} unlocked!` : '';
    note.hidden = opened < 0;
  }
}
