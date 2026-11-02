import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';
import './styles.css';
import './modes.css';
import { AudioEngine } from './audio/audio';
import { Music } from './audio/music';
import { playEvents, playNearMiss } from './audio/sfx';
import { createLoop } from './core/loop';
import { parseSeed, randomSeed } from './core/rng';
import { Keyboard } from './input/keyboard';
import { readInput } from './input/input';
import { TouchControls } from './input/touch';
import { Effects } from './render/effects';
import { DEATHCAM_SKIP_GRACE_S } from './render/feel';
import { NEAR_MISS_START, nearMisses } from './render/nearMiss';
import { Renderer } from './render/renderer';
import { deathcamDuration, deathcamFrame, pushFrame, spottedIndex } from './render/rewind';
import { dequantizeInput, InputRecorder, quantizeInput } from './sim/input';
import { dailyDateOf, dailySeed, encodeLog } from './sim/replay';
import type { Level } from './sim/campaign';
import { MODE_LABELS, parseMode, rulesForMode, type ModeId, type RunRules } from './sim/rules';
import { scoreOf } from './sim/scoring';
import type { World } from './sim/types';
import { createWorld, step } from './sim/world';
import {
  flushEvents,
  setTokenProvider,
  setupAnalyticsFlush,
  track,
  APP_VERSION,
} from './ui/analytics';
import { pickBootSeed } from './ui/bootSeed';
import { CampaignUi } from './ui/campaign';
import { $, formatTime, isTypingTarget } from './ui/dom';
import { Hud } from './ui/hud';
import { isStandalone, setupInstall } from './ui/install';
import { ModesUi, showPlayMode } from './ui/modes';
import { OnlineUi } from './ui/onlineUi';
import { END_DELAY, rankedHeadline } from './ui/runEnd';
import { dueHints } from './ui/hints';
import { paceSeconds, recordPace } from './ui/pace';
import { addTick, closestDucks, EMPTY_RUN_STATS, eggsPerMinute } from './ui/runStats';
import { fillGameOver, showScreen } from './ui/screens';
import {
  loadBest,
  loadBestTimeline,
  loadHintsSeen,
  loadMode,
  loadMuted,
  saveBest,
  saveBestTimeline,
  saveHintsSeen,
  saveMode,
  saveMuted,
  takeUpdatedFrom,
} from './ui/storage';
import { setupUpdates } from './ui/updates';

/**
 * `ending`: the run is over (chomp, buzzer) and its animation plays before the card.
 * `deathcam`: after a catch, the last seconds replay from the recorded worlds before the card.
 */
type Phase = 'title' | 'playing' | 'paused' | 'ending' | 'deathcam' | 'over';

const MUSIC_INTENSITY = { wander: 0, search: 0.5, chase: 1 } as const;

function seedUrl(seed: string, mode: ModeId, keepChallenge = false): string {
  const url = new URL(window.location.href);
  url.searchParams.set('seed', seed);
  if (mode === 'classic') url.searchParams.delete('mode');
  else url.searchParams.set('mode', mode);
  if (!keepChallenge) url.searchParams.delete('challenge');
  return url.toString();
}

/** A link's `mode` wins; a bare seed link (older shares) is classic; otherwise the last mode played. */
function bootMode(params: URLSearchParams): ModeId {
  return parseMode(params.get('mode')) ?? (params.has('seed') ? 'classic' : loadMode());
}

const todayIso = (): string => dailyDateOf(dailySeed(new Date())) as string;

/** Referring site's host only (never the full URL); empty for direct visits and in-app reloads. */
function referrerHost(): string {
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : '';
    return host === window.location.hostname ? '' : host.slice(0, 64);
  } catch {
    return '';
  }
}

function trackBoot(): void {
  const updatedFrom = takeUpdatedFrom();
  if (updatedFrom && updatedFrom !== APP_VERSION)
    track('update_applied', { from: updatedFrom, to: APP_VERSION });
  track('title_view', { installed: isStandalone(), referrer: referrerHost() });
}

function boot(): void {
  const canvas = $<HTMLCanvasElement>('#stage');
  const renderer = new Renderer(canvas);
  const keyboard = new Keyboard();
  const touch = new TouchControls(canvas, $('#stick'), $('#stick-knob'), $('#sprint-btn'));
  const hud = new Hud();
  const fx = new Effects();
  const audio = new AudioEngine(loadMuted());
  const music = new Music(audio);
  const muteBtn = $<HTMLButtonElement>('#mute-btn');
  const online = new OnlineUi(showScreen, todayIso);
  const install = setupInstall();
  setTokenProvider(() => online.accessToken());
  const recorder = new InputRecorder();

  const params = new URL(window.location.href).searchParams;
  let seed = pickBootSeed(parseSeed(params.get('seed')), dailySeed(new Date()));
  let mode = bootMode(params);
  // A shared-score link pins its seed and mode; the banner applies only while playing exactly that.
  const challenge = params.get('challenge') ? { seed, mode } : null;
  /** The campaign level being played, or null for a ranked run. */
  let level: Level | null = null;
  let world: World = createWorld(seed, rulesForMode(mode));
  let prev = world;
  let phase: Phase = 'title';
  let endTimer = 0;
  let clock = 0;
  // Render/UI-only run trackers, all fed from the worlds the sim already produced.
  let frames: readonly World[] = [];
  let nearMiss = NEAR_MISS_START;
  let stats = EMPTY_RUN_STATS;
  let timeline: readonly number[] = [];
  let bestTimeline: readonly number[] = [];
  let bestScore = 0;
  let hintsSeen = loadHintsSeen();
  let cam = { elapsed: 0, duration: 0, still: false, spotted: null as number | null };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const boardOpen = () => !$('#screen-board').hidden;
  // Reload into a new build only where no run can be lost; the title screen is the safe spot.
  const updates = setupUpdates({
    canApplyNow: () => phase === 'title' && !boardOpen(),
    canApplyWhileHidden: () => phase === 'title' || phase === 'over',
  });
  const closeBoard = () => {
    online.closeBoard();
    updates.maybeApply();
  };

  renderer.setMap(world.map);
  const showTitle = () => {
    $('#title-seed').textContent = seed;
    $('#title-best').textContent = String(loadBest(mode));
    showPlayMode(mode);
    showScreen('title');
  };
  void online.showChallenge(params.get('challenge'), seed, mode);

  const syncMute = () => {
    muteBtn.setAttribute('aria-pressed', String(audio.isMuted));
    muteBtn.setAttribute('aria-label', audio.isMuted ? 'Unmute sound' : 'Mute sound');
    muteBtn.dataset.muted = String(audio.isMuted);
  };
  syncMute();

  const toggleMute = () => {
    audio.unlock();
    audio.setMuted(!audio.isMuted);
    saveMuted(audio.isMuted);
    syncMute();
  };

  const beginRun = (runSeed: string, rules: RunRules) => {
    world = createWorld(runSeed, rules);
    prev = world;
    renderer.setMap(world.map);
    recorder.reset();
    fx.reset();
    fx.reducedMotion = reducedMotion.matches;
    frames = [];
    nearMiss = NEAR_MISS_START;
    stats = EMPTY_RUN_STATS;
    timeline = [];
    bestTimeline = level ? [] : loadBestTimeline(mode);
    bestScore = level ? 0 : loadBest(mode);
    touch.reset();
    hud.reset(world);
    hud.show(true);
    showScreen(null);
    music.stop();
    music.start();
    phase = 'playing';
  };

  /** A ranked run: classic, rush or ducklings. */
  const startRun = (nextSeed: string, nextMode: ModeId = mode) => {
    audio.unlock();
    const fromOver = phase === 'over';
    if (fromOver) track('retry');
    const daily = nextMode === 'classic' && nextSeed === dailySeed(new Date());
    track('run_start', { seed: nextSeed, daily, fromOver, mode: nextMode });
    level = null;
    seed = nextSeed;
    mode = nextMode;
    const isChallenge = challenge?.seed === seed && challenge.mode === mode;
    if (!isChallenge) $('#challenge-banner').hidden = true;
    window.history.replaceState(null, '', seedUrl(seed, mode, isChallenge));
    beginRun(seed, rulesForMode(mode));
  };

  /** A campaign level: local and unranked, so the ranked seed, URL and bests stay as they were. */
  const startLevel = (next: Level) => {
    audio.unlock();
    const fromOver = phase === 'over';
    if (fromOver) track('retry');
    track('run_start', { seed: next.seed, daily: false, fromOver, mode: 'campaign', level: next.id });
    level = next;
    $('#challenge-banner').hidden = true;
    beginRun(next.seed, next.rules);
  };

  const pause = () => {
    if (phase !== 'playing') return;
    phase = 'paused';
    music.stop();
    touch.reset();
    showScreen('pause');
  };

  const resume = () => {
    if (phase !== 'paused') return;
    audio.unlock();
    showScreen(null);
    music.start();
    phase = 'playing';
  };

  const feelProps = () => ({ nearMisses: nearMiss.count, spottedCount: world.timesSpotted });

  const startDeathcam = () => {
    phase = 'deathcam';
    const still = reducedMotion.matches;
    cam = { elapsed: 0, still, spotted: spottedIndex(frames), duration: deathcamDuration(frames.length, still) };
    hud.show(false);
    hud.clearHints();
    $('#deathcam').hidden = false;
  };

  const endDeathcam = (skipped: boolean) => {
    $('#deathcam').hidden = true;
    if (skipped) track('deathcam_skip', { at: Math.round(cam.elapsed * 10) / 10 });
    finish();
  };

  const finishLevel = (played: Level) => {
    hud.show(false);
    const { stars } = campaign.finish(played, world);
    const outcome = world.status === 'playing' ? 'caught' : world.status;
    track('level_end', { level: played.id, cleared: outcome === 'cleared', stars, outcome });
    track('run_end', {
      sec: world.time,
      eggs: world.eggsCollected,
      score: 0,
      mode: 'campaign',
      level: played.id,
      ...feelProps(),
    });
    void flushEvents();
  };

  const finish = () => {
    phase = 'over';
    if (level) {
      finishLevel(level);
      return;
    }
    const score = scoreOf(world);
    const previousBest = loadBest(mode);
    const isNewBest = score > previousBest;
    if (isNewBest) {
      saveBest(mode, score);
      saveBestTimeline(mode, timeline);
    }
    const closest = closestDucks(stats);
    fillGameOver({
      ...rankedHeadline(world.status),
      score,
      eggs: world.rules.ducklings ? world.bankedDucklings : world.eggsCollected,
      eggsLabel: world.rules.ducklings ? 'Banked' : 'Eggs',
      time: formatTime(world.time),
      best: Math.max(score, previousBest),
      isNewBest,
      seed,
      modeLabel: mode === 'classic' ? '' : MODE_LABELS[mode],
      unseen: formatTime(stats.unseenSec),
      closest: closest === null ? '—' : `${closest.toFixed(1)} ducks`,
      eggsPerMin: eggsPerMinute(stats).toFixed(1),
      spotted: stats.spotted,
    });
    hud.show(false);
    showScreen('over');
    install.onRunFinished();
    void online.onGameOver(seed, encodeLog(recorder.bytes()), mode);
    track('run_end', { sec: world.time, eggs: world.eggsCollected, banked: world.bankedDucklings, score, mode, ...feelProps() });
    void flushEvents();
  };

  /** Fold one sim step into the death cam buffer, run stats, pace, near misses and hints. */
  const observe = (dt: number) => {
    frames = pushFrame(frames, world);
    stats = addTick(stats, world, dt);
    if (!level) timeline = recordPace(timeline, world.time, scoreOf(world));
    nearMiss = nearMisses(nearMiss, world);
    if (nearMiss.fired) {
      fx.popup(world.duck.pos, 'Close shave!', '#ffffff');
      playNearMiss(audio);
    }
    const hints = dueHints(world.events, hintsSeen);
    if (hints.due.length) {
      hintsSeen = hints.seen;
      saveHintsSeen(hintsSeen);
      hud.hint(hints.due);
    }
  };

  const update = (dt: number) => {
    if (phase === 'deathcam') {
      cam.elapsed += dt;
      if (cam.elapsed >= cam.duration) endDeathcam(false);
      return;
    }
    if (phase === 'ending') {
      endTimer -= dt;
      if (endTimer > 0) return;
      if (world.status === 'caught' && frames.length > 1) startDeathcam();
      else finish();
      return;
    }
    if (phase !== 'playing') return;
    prev = world;
    // The sim only ever sees quantized input, so the recorded log replays identically on the server.
    const input = quantizeInput(readInput(keyboard, touch));
    recorder.push(input);
    world = step(world, dequantizeInput(input), dt);
    observe(dt);
    if (world.events.length) {
      fx.handle(world.events);
      playEvents(audio, world.events);
    }
    music.setIntensity(MUSIC_INTENSITY[world.gator.mode]);
    if (world.status !== 'playing') {
      phase = 'ending';
      endTimer = END_DELAY[world.status];
      music.stop();
    }
  };

  const pace = () =>
    level || bestTimeline.length === 0 ? null : paceSeconds(bestTimeline, bestScore, world.time, scoreOf(world));

  const renderReplay = () => {
    const f = deathcamFrame(frames.length, cam.elapsed, cam.still, cam.spotted);
    const a = frames[f.index] as World;
    const spot = cam.spotted === null || f.index < cam.spotted ? null : frames[cam.spotted];
    renderer.render(a, frames[f.index + 1] ?? a, f.alpha, fx, clock, { spottedAt: spot?.duck.pos ?? null });
  };

  const render = (alpha: number, frameDt: number) => {
    // A reduced-motion death cam is one still frame, so its clock and particles hold too.
    const animating = phase !== 'paused' && !(phase === 'deathcam' && cam.still);
    if (animating) {
      if (!fx.frozen) clock += frameDt;
      fx.update(frameDt);
    }
    if (phase === 'deathcam') {
      renderReplay();
      return;
    }
    renderer.render(prev, world, phase === 'playing' ? alpha : 1, fx, clock);
    if (phase === 'playing' || phase === 'ending') hud.update(world, pace());
  };

  // Buttons.
  $('#play-btn').addEventListener('click', () => startRun(seed));
  $('#daily-btn').addEventListener('click', () => startRun(dailySeed(new Date()), 'classic'));
  const modes = new ModesUi(
    (picked) => {
      track('mode_select', { mode: picked });
      saveMode(picked);
      startRun(seed, picked);
    },
    showTitle,
  );
  const openModes = () => {
    modes.prepare(mode);
    $('#campaign-card-stars').textContent = String(campaign.totalStars());
    showScreen('modes');
  };
  const campaign = new CampaignUi({ show: showScreen, play: startLevel, back: openModes });
  $('#campaign-card').addEventListener('click', () => {
    track('mode_select', { mode: 'campaign' });
    campaign.open();
  });
  $('#modes-btn').addEventListener('click', openModes);
  $('#title-board-btn').addEventListener('click', () => void online.openBoard('title', mode));
  $('#over-board-btn').addEventListener('click', () => void online.openBoard('over', mode));
  $('#board-back-btn').addEventListener('click', closeBoard);
  $('#resume-btn').addEventListener('click', resume);
  /** Back to the title, where the mode is picked; the run, if any, is abandoned. */
  const goToTitle = () => {
    phase = 'title';
    level = null;
    hud.show(false);
    showTitle();
    updates.maybeApply();
  };
  $('#quit-btn').addEventListener('click', goToTitle);
  $('#over-menu-btn').addEventListener('click', goToTitle);
  $('#level-menu-btn').addEventListener('click', goToTitle);
  $('#retry-btn').addEventListener('click', () => startRun(seed));
  $('#new-btn').addEventListener('click', () => startRun(randomSeed()));
  $('#pause-btn').addEventListener('click', pause);
  muteBtn.addEventListener('click', toggleMute);
  const copyBtn = $<HTMLButtonElement>('#copy-btn');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(online.lastShareUrl ?? seedUrl(seed, mode));
      copyBtn.textContent = 'Copied!';
      track('share', { via: 'copy' });
    } catch {
      copyBtn.textContent = 'Copy failed';
    }
    window.setTimeout(() => (copyBtn.textContent = 'Copy link'), 1500);
  });

  // Global keys.
  window.addEventListener('keydown', (e) => {
    if (e.repeat || isTypingTarget(e.target)) return;
    if (phase === 'deathcam') {
      // Modifiers and Tab stay with the browser (shortcuts, focus); everything else skips.
      if (e.metaKey || e.ctrlKey || e.altKey || /^(Shift|Control|Alt|Meta|Tab)/.test(e.code)) return;
      if (cam.elapsed < DEATHCAM_SKIP_GRACE_S) return;
      // Swallowing the key keeps Space or Enter from also pressing the card's Retry.
      e.preventDefault();
      endDeathcam(true);
      return;
    }
    if (e.code === 'Escape' && boardOpen()) {
      closeBoard();
    } else if (e.code === 'Escape' && !$('#screen-modes').hidden) {
      showTitle();
    } else if (e.code === 'Escape' && !$('#screen-campaign').hidden) {
      openModes();
    } else if (e.code === 'Escape' && !$('#screen-level').hidden) {
      campaign.open(level?.id);
    } else if (e.code === 'Escape' && !$('#screen-over').hidden) {
      goToTitle();
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (phase === 'playing') pause();
      else if (phase === 'paused') resume();
    } else if (e.code === 'KeyM') {
      toggleMute();
    } else if (
      (e.code === 'Enter' || (e.code === 'Space' && phase === 'over')) &&
      // A focused button handles Enter and Space itself; acting here too would start two runs.
      !(e.target instanceof HTMLButtonElement) &&
      !boardOpen()
    ) {
      e.preventDefault();
      // The retry press must not also read as a held sprint in the new run.
      if (e.code === 'Space') keyboard.release('Space');
      if (phase === 'over' && level) startLevel(level);
      else if (phase === 'title' || phase === 'over') startRun(seed);
    }
  });
  window.addEventListener('pointerdown', () => {
    if (phase === 'deathcam' && cam.elapsed >= DEATHCAM_SKIP_GRACE_S) endDeathcam(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('resize', () => renderer.resize());
  window.visualViewport?.addEventListener('resize', () => renderer.resize());

  if (import.meta.env.DEV) {
    // Dev-only hook for browser-driven testing; stripped from production builds.
    Object.assign(window, {
      __gator: {
        get: () => world,
        set: (w: World) => ((prev = w), (world = w)),
        phase: () => phase,
        shake: () => fx.shake,
      },
    });
  }

  renderer.resize();
  setupAnalyticsFlush();
  trackBoot();
  void flushEvents();

  void online.flushPending();
  showTitle();
  createLoop(update, render).start();
}

try {
  boot();
} catch (err) {
  console.error('Gator Gotcha failed to start', err);
  const fallback = document.getElementById('boot-error');
  if (fallback) fallback.hidden = false;
}
