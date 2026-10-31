import { SIM_DT } from '../config';
import { $, formatTime } from './dom';
import { browserStore, createPendingRuns, flushDecision, type PendingRun, type SubmitStatus } from './pendingRuns';
import type { ScreenId } from './screens';

type OnlineModule = typeof import('../online');
type Board = 'all' | 'daily';

const ONLINE_CONFIGURED = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Stays under the server's 10 submissions/minute rate limit. */
const FLUSH_BATCH = 8;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

/** HTTP status of a failed submit; anything without one (offline, chunk failed to load) is a network failure. */
function statusOf(err: unknown): SubmitStatus {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : 'network';
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Leaderboard, score submission, nickname and sharing UI. The supabase-backed module is
 * loaded on demand so the game itself stays tiny and fully playable offline.
 */
export class OnlineUi {
  private mod: Promise<OnlineModule> | null = null;
  private lastScoreId: string | null = null;
  private tab: Board = 'all';
  private backTo: ScreenId = 'title';
  private submitToken = 0;
  private flushing = false;
  private readonly pending = createPendingRuns(browserStore());
  private readonly pendingNote = $('#pending-note');

  private readonly status = $('#over-status');
  private readonly panel = $('#over-online');
  private readonly nickForm = $<HTMLFormElement>('#nickname-form');
  private readonly nickInput = $<HTMLInputElement>('#nickname-input');
  private readonly nickError = $('#nickname-error');
  private readonly shareBtn = $<HTMLButtonElement>('#fb-share-btn');
  private readonly fbLinkBtn = $<HTMLButtonElement>('#fb-link-btn');
  private readonly boardList = $<HTMLOListElement>('#board-list');
  private readonly boardStatus = $('#board-status');
  private readonly tabAll = $<HTMLButtonElement>('#tab-all');
  private readonly tabDaily = $<HTMLButtonElement>('#tab-daily');

  constructor(
    private readonly show: (id: ScreenId) => void,
    private readonly todayIso: () => string,
  ) {
    if (!ONLINE_CONFIGURED) {
      document.querySelectorAll<HTMLElement>('[data-online]').forEach((el) => (el.hidden = true));
      return;
    }
    this.shareBtn.addEventListener('click', () => void this.share());
    this.fbLinkBtn.addEventListener('click', () => void this.linkFacebook());
    this.nickForm.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.saveNickname();
    });
    this.tabAll.addEventListener('click', () => void this.renderBoard('all'));
    this.tabDaily.addEventListener('click', () => void this.renderBoard('daily'));
    window.addEventListener('online', () => void this.flushPending());
    this.refreshPendingNote();
  }

  get enabled(): boolean {
    return ONLINE_CONFIGURED;
  }

  /** Share URL for the last submitted run, if any. */
  get lastShareUrl(): string | null {
    return this.lastScoreId ? `${window.location.origin}/s/${this.lastScoreId}` : null;
  }

  private load(): Promise<OnlineModule> {
    this.mod ??= import('../online').catch((err: unknown) => {
      this.mod = null;
      throw err;
    });
    return this.mod;
  }

  /** Submit a finished run and show the verified rank; offline runs are queued for later. */
  async onGameOver(seed: string, encodedLog: string): Promise<void> {
    if (!ONLINE_CONFIGURED) return;
    const token = ++this.submitToken;
    const run: PendingRun = { seed, log: encodedLog, finishedAt: Date.now() };
    this.lastScoreId = null;
    this.panel.hidden = false;
    this.shareBtn.disabled = true;
    this.shareBtn.hidden = false;
    this.nickError.textContent = '';
    if (!navigator.onLine) {
      this.queue(run);
      return;
    }
    this.setStatus('Checking your run with the swamp judges…', 'pending');
    try {
      const online = await this.load();
      const result = await online.submitRun(seed, encodedLog);
      if (token !== this.submitToken) return;
      this.lastScoreId = result.id;
      this.shareBtn.disabled = false;
      const daily = result.dailyRank ? ` · #${result.dailyRank} today` : '';
      this.setStatus(`Verified! #${result.rank} all-time${daily}`, 'ok');
      this.fbLinkBtn.hidden = !online.isFacebookEnabled();
      await this.showNickname(online);
      void this.flushPending();
    } catch (err) {
      if (token !== this.submitToken) return;
      if (statusOf(err) === 'network') this.queue(run);
      else this.setStatus(`Score not saved: ${errorText(err)}`, 'error');
    }
  }

  private queue(run: PendingRun): void {
    this.pending.enqueue(run);
    this.shareBtn.hidden = true;
    this.setStatus('Saved offline. It’ll post to the leaderboard when you’re back online.', 'queued');
    this.refreshPendingNote();
  }

  /** Post queued offline runs, oldest first. Safe to call any time; it no-ops when offline or busy. */
  async flushPending(): Promise<void> {
    if (!ONLINE_CONFIGURED || this.flushing || !navigator.onLine) return;
    const runs = this.pending.peekAll().slice(0, FLUSH_BATCH);
    if (!runs.length) return;
    this.flushing = true;
    let posted = 0;
    try {
      const online = await this.load();
      for (const run of runs) {
        let status: SubmitStatus = 201;
        try {
          await online.submitRun(run.seed, run.log);
        } catch (err) {
          status = statusOf(err);
        }
        const decision = flushDecision(status);
        if (decision === 'remove') this.pending.remove(run);
        if (status === 201) posted++;
        if (decision === 'stop') break;
      }
    } catch (err) {
      // The online chunk failed to load; the queue is untouched and retried on the next 'online' event.
      console.warn('Could not post offline runs', err);
    } finally {
      this.flushing = false;
      this.refreshPendingNote(posted);
    }
  }

  private refreshPendingNote(justPosted = 0): void {
    if (!ONLINE_CONFIGURED) return;
    const waiting = this.pending.count();
    const parts = [
      justPosted ? `Posted ${plural(justPosted, 'offline run')} to the leaderboard!` : '',
      waiting ? `${plural(waiting, 'run')} waiting to post` : '',
    ].filter(Boolean);
    this.pendingNote.textContent = parts.join(' · ');
    this.pendingNote.hidden = parts.length === 0;
  }

  private async showNickname(online: OnlineModule): Promise<void> {
    const name = await online.getMyNickname();
    if (!name) return;
    this.nickInput.value = name;
    this.nickForm.hidden = false;
  }

  private async saveNickname(): Promise<void> {
    this.nickError.textContent = '';
    try {
      const online = await this.load();
      await online.setNickname(this.nickInput.value);
      this.nickError.textContent = 'Saved!';
    } catch (err) {
      this.nickError.textContent = errorText(err);
    }
  }

  private async share(): Promise<void> {
    if (!this.lastScoreId) return;
    const online = await this.load();
    online.shareToFacebook(this.lastScoreId);
  }

  private async linkFacebook(): Promise<void> {
    try {
      const online = await this.load();
      await online.linkFacebook();
    } catch (err) {
      this.setStatus(`Facebook: ${errorText(err)}`, 'error');
    }
  }

  async openBoard(from: ScreenId): Promise<void> {
    if (!ONLINE_CONFIGURED) return;
    this.backTo = from;
    this.show('board');
    await this.renderBoard(this.tab);
  }

  closeBoard(): void {
    this.show(this.backTo);
  }

  private async renderBoard(tab: Board): Promise<void> {
    this.tab = tab;
    this.tabAll.setAttribute('aria-selected', String(tab === 'all'));
    this.tabDaily.setAttribute('aria-selected', String(tab === 'daily'));
    this.boardList.replaceChildren();
    this.boardStatus.textContent = 'Loading…';
    try {
      const online = await this.load();
      const [rows, me] = await Promise.all([
        online.fetchBoard(tab, tab === 'daily' ? this.todayIso() : null),
        online.currentUserId(),
      ]);
      if (this.tab !== tab) return;
      this.boardStatus.textContent = rows.length
        ? ''
        : tab === 'daily'
          ? 'No scores on today’s swamp yet. Be the first!'
          : 'No scores yet. Be the first!';
      this.boardList.replaceChildren(...rows.map((r) => boardRow(r, r.userId === me)));
    } catch (err) {
      const offline = !navigator.onLine || /failed to fetch|network|load failed/i.test(errorText(err));
      this.boardStatus.textContent = offline
        ? 'You’re offline. Leaderboards need a connection.'
        : `Couldn’t load the leaderboard: ${errorText(err)}`;
    }
  }

  /** Show "Beat X's score" on the title screen when arriving from a shared link. */
  async showChallenge(id: string | null, seed: string): Promise<void> {
    if (!ONLINE_CONFIGURED || !id || !UUID.test(id)) return;
    try {
      const online = await this.load();
      const c = await online.fetchChallenge(id);
      if (!c || c.seed !== seed) return;
      const banner = $('#challenge-banner');
      banner.textContent = `Beat ${c.nickname}’s ${c.score.toLocaleString()} on this swamp!`;
      banner.hidden = false;
    } catch {
      // A missing challenge just means no banner.
    }
  }

  private setStatus(text: string, tone: 'pending' | 'ok' | 'queued' | 'error'): void {
    this.status.textContent = text;
    this.status.dataset.tone = tone;
  }
}

function boardRow(
  r: { rank: number; nickname: string; score: number; eggs: number; ticks: number },
  isMe: boolean,
): HTMLLIElement {
  const li = document.createElement('li');
  li.className = isMe ? 'board-row is-me' : 'board-row';
  const cell = (cls: string, text: string) => {
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = text;
    return span;
  };
  li.append(
    cell('board-rank', `#${r.rank}`),
    cell('board-name', isMe ? `${r.nickname} (you)` : r.nickname),
    cell('board-meta', `${r.eggs} eggs · ${formatTime(r.ticks * SIM_DT)}`),
    cell('board-score', r.score.toLocaleString()),
  );
  return li;
}
