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
import { computeScore } from './sim/scoring';
import type { World } from './sim/types';
import { createWorld, step } from './sim/world';
import { $, formatTime } from './ui/dom';
import { Hud } from './ui/hud';
import { fillGameOver, showScreen } from './ui/screens';
import { loadBest, loadMuted, saveBest, saveMuted } from './ui/storage';

type Phase = 'title' | 'playing' | 'paused' | 'caught' | 'over';

/** Time the chomp animation plays before the game-over card appears. */
const CAUGHT_DELAY = 1.1;
const MUSIC_INTENSITY = { wander: 0, search: 0.5, chase: 1 } as const;

function seedUrl(seed: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set('seed', seed);
  return url.toString();
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

  let seed = parseSeed(new URL(window.location.href).searchParams.get('seed')) ?? randomSeed();
  let world: World = createWorld(seed);
  let prev = world;
  let phase: Phase = 'title';
  let caughtTimer = 0;
  let clock = 0;
  let best = loadBest();

  renderer.setMap(world.map);
  $('#title-seed').textContent = seed;
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
    window.history.replaceState(null, '', seedUrl(seed));
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
  };

  const update = (dt: number) => {
    if (phase === 'caught') {
      caughtTimer -= dt;
      if (caughtTimer <= 0) finish();
      return;
    }
    if (phase !== 'playing') return;
    prev = world;
    world = step(world, readInput(keyboard, touch), dt);
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
      await navigator.clipboard.writeText(seedUrl(seed));
      copyBtn.textContent = 'Copied!';
    } catch {
      copyBtn.textContent = 'Copy failed';
    }
    window.setTimeout(() => (copyBtn.textContent = 'Copy link'), 1500);
  });

  // Global keys.
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (phase === 'playing') pause();
      else if (phase === 'paused') resume();
    } else if (e.code === 'KeyM') {
      toggleMute();
    } else if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
      if (phase === 'title' || phase === 'over') startRun(seed);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('resize', () => renderer.resize());

  if (import.meta.env.DEV) {
    // Dev-only hook for browser-driven testing; stripped from production builds.
    Object.assign(window, {
      __gator: { get: () => world, set: (w: World) => ((prev = w), (world = w)), phase: () => phase },
    });
  }

  renderer.resize();
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
