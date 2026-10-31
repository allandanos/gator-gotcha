import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';
import './styles.css';
import { AudioEngine } from './audio/audio';
import { Music } from './audio/music';
import { playEvents } from './audio/sfx';
import { createLoop } from './core/loop';
import { parseSeed, randomSeed } from './core/rng';
import { Keyboard } from './input/keyboard';
import { readInput } from './input/input';
import { TouchControls } from './input/touch';
import { Effects } from './render/effects';
import { Renderer } from './render/renderer';
import { dequantizeInput, InputRecorder, quantizeInput } from './sim/input';
import { dailyDateOf, dailySeed, encodeLog } from './sim/replay';
import { computeScore } from './sim/scoring';
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
import { $, formatTime, isTypingTarget } from './ui/dom';
import { Hud } from './ui/hud';
import { isStandalone, setupInstall } from './ui/install';
import { OnlineUi } from './ui/onlineUi';
import { fillGameOver, showScreen } from './ui/screens';
import {
  loadBest,
  loadMuted,
  loadSeed,
  saveBest,
  saveMuted,
  saveSeed,
  takeUpdatedFrom,
} from './ui/storage';
import { setupUpdates } from './ui/updates';

type Phase = 'title' | 'playing' | 'paused' | 'caught' | 'over';

/** Time the chomp animation plays before the game-over card appears. */
const CAUGHT_DELAY = 1.1;
const MUSIC_INTENSITY = { wander: 0, search: 0.5, chase: 1 } as const;

function seedUrl(seed: string, keepChallenge = false): string {
  const url = new URL(window.location.href);
  url.searchParams.set('seed', seed);
  if (!keepChallenge) url.searchParams.delete('challenge');
  return url.toString();
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
  setTokenProvider(() => online.accessToken());
  const recorder = new InputRecorder();

  const params = new URL(window.location.href).searchParams;
  let seed =
    pickBootSeed(parseSeed(params.get('seed')), loadSeed(), dailySeed(new Date())) ?? randomSeed();
  saveSeed(seed);
  // A shared-score link pins its seed; the challenge banner applies only while playing that seed.
  const challengeSeed = params.get('challenge') ? seed : null;
  let world: World = createWorld(seed);
  let prev = world;
  let phase: Phase = 'title';
  let caughtTimer = 0;
  let clock = 0;
  let best = loadBest();

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
  $('#title-seed').textContent = seed;
  void online.showChallenge(params.get('challenge'), seed);
  $('#title-best').textContent = String(best);

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

  const startRun = (nextSeed: string) => {
    audio.unlock();
    const fromOver = phase === 'over';
    if (fromOver) track('retry');
    track('run_start', { seed: nextSeed, daily: nextSeed === dailySeed(new Date()), fromOver });
    seed = nextSeed;
    saveSeed(seed);
    world = createWorld(seed);
    prev = world;
    renderer.setMap(world.map);
    recorder.reset();
    const isChallenge = seed === challengeSeed;
    if (!isChallenge) $('#challenge-banner').hidden = true;
    window.history.replaceState(null, '', seedUrl(seed, isChallenge));
    fx.reset();
    touch.reset();
    hud.show(true);
    showScreen(null);
    music.stop();
    music.start();
    phase = 'playing';
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

  const finish = () => {
    phase = 'over';
    const score = computeScore(world.eggsCollected, world.time);
    const isNewBest = score > best;
    if (isNewBest) {
      best = score;
      saveBest(best);
    }
    fillGameOver({
      score,
      eggs: world.eggsCollected,
      time: formatTime(world.time),
      best,
      isNewBest,
      seed,
    });
    hud.show(false);
    showScreen('over');
    void online.onGameOver(seed, encodeLog(recorder.bytes()));
    track('run_end', { sec: world.time, eggs: world.eggsCollected, score });
    void flushEvents();
  };

  const update = (dt: number) => {
    if (phase === 'caught') {
      caughtTimer -= dt;
      if (caughtTimer <= 0) finish();
      return;
    }
    if (phase !== 'playing') return;
    prev = world;
    // The sim only ever sees quantized input, so the recorded log replays identically on the server.
    const input = quantizeInput(readInput(keyboard, touch));
    recorder.push(input);
    world = step(world, dequantizeInput(input), dt);
    if (world.events.length) {
      fx.handle(world.events);
      playEvents(audio, world.events);
    }
    music.setIntensity(MUSIC_INTENSITY[world.gator.mode]);
    if (world.status === 'caught') {
      phase = 'caught';
      caughtTimer = CAUGHT_DELAY;
      music.stop();
    }
  };

  const render = (alpha: number, frameDt: number) => {
    const animating = phase !== 'paused';
    if (animating) {
      clock += frameDt;
      fx.update(frameDt);
    }
    renderer.render(prev, world, phase === 'playing' ? alpha : 1, fx, clock);
    if (phase === 'playing' || phase === 'caught') hud.update(world);
  };

  // Buttons.
  $('#play-btn').addEventListener('click', () => startRun(seed));
  $('#daily-btn').addEventListener('click', () => startRun(dailySeed(new Date())));
  $('#title-board-btn').addEventListener('click', () => void online.openBoard('title'));
  $('#over-board-btn').addEventListener('click', () => void online.openBoard('over'));
  $('#board-back-btn').addEventListener('click', closeBoard);
  $('#resume-btn').addEventListener('click', resume);
  $('#quit-btn').addEventListener('click', () => {
    phase = 'title';
    hud.show(false);
    $('#title-best').textContent = String(best);
    $('#title-seed').textContent = seed;
    showScreen('title');
    updates.maybeApply();
  });
  $('#retry-btn').addEventListener('click', () => startRun(seed));
  $('#new-btn').addEventListener('click', () => startRun(randomSeed()));
  $('#pause-btn').addEventListener('click', pause);
  muteBtn.addEventListener('click', toggleMute);
  const copyBtn = $<HTMLButtonElement>('#copy-btn');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(online.lastShareUrl ?? seedUrl(seed));
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
    if (e.code === 'Escape' && boardOpen()) {
      closeBoard();
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (phase === 'playing') pause();
      else if (phase === 'paused') resume();
    } else if (e.code === 'KeyM') {
      toggleMute();
    } else if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement) && !boardOpen()) {
      if (phase === 'title' || phase === 'over') startRun(seed);
    }
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
      },
    });
  }

  renderer.resize();
  setupInstall();
  setupAnalyticsFlush();
  trackBoot();
  void flushEvents();

  void online.flushPending();
  showScreen('title');
  createLoop(update, render).start();
}

try {
  boot();
} catch (err) {
  console.error('Gator Gotcha failed to start', err);
  const fallback = document.getElementById('boot-error');
  if (fallback) fallback.hidden = false;
}
