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
import { $, formatTime, isTypingTarget } from './ui/dom';
import { Hud } from './ui/hud';
import { setupInstall } from './ui/install';
import { OnlineUi } from './ui/onlineUi';
import { fillGameOver, showScreen } from './ui/screens';
import { loadBest, loadMuted, saveBest, saveMuted } from './ui/storage';

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
  const recorder = new InputRecorder();

  const params = new URL(window.location.href).searchParams;
  let seed = parseSeed(params.get('seed')) ?? randomSeed();
  // A shared-score link pins its seed; the challenge banner applies only while playing that seed.
  const challengeSeed = params.get('challenge') ? seed : null;
  let world: World = createWorld(seed);
  let prev = world;
  let phase: Phase = 'title';
  let caughtTimer = 0;
  let clock = 0;
  let best = loadBest();

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
    seed = nextSeed;
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
    fillGameOver({ score, eggs: world.eggsCollected, time: formatTime(world.time), best, isNewBest, seed });
    hud.show(false);
    showScreen('over');
    void online.onGameOver(seed, encodeLog(recorder.bytes()));
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
  $('#board-back-btn').addEventListener('click', () => online.closeBoard());
  $('#resume-btn').addEventListener('click', resume);
  $('#quit-btn').addEventListener('click', () => {
    phase = 'title';
    hud.show(false);
    $('#title-best').textContent = String(best);
    showScreen('title');
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
    } catch {
      copyBtn.textContent = 'Copy failed';
    }
    window.setTimeout(() => (copyBtn.textContent = 'Copy link'), 1500);
  });

  // Global keys.
  const boardOpen = () => !$('#screen-board').hidden;
  window.addEventListener('keydown', (e) => {
    if (e.repeat || isTypingTarget(e.target)) return;
    if (e.code === 'Escape' && boardOpen()) {
      online.closeBoard();
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
      __gator: { get: () => world, set: (w: World) => ((prev = w), (world = w)), phase: () => phase },
    });
  }

  renderer.resize();
  setupInstall();
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
