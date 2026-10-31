import { ARENA, NAV_CELL } from '../config';
import { circleIntersectsRect } from './geometry';
import type { NavGrid, Obstacle } from './types';
import { dhypot } from '../core/dmath';
import type { Vec } from '../core/vec';

export interface Cell {
  readonly c: number;
  readonly r: number;
}

/** Build a grid where a cell is blocked if a circle of radius `inflate` at its center would hit something. */
export function buildNav(obstacles: readonly Obstacle[], inflate: number, cell = NAV_CELL): NavGrid {
  const cols = Math.ceil(ARENA.width / cell);
  const rows = Math.ceil(ARENA.height / cell);
  const blocked = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = { x: (c + 0.5) * cell, y: (r + 0.5) * cell };
      const nearWall =
        p.x < inflate || p.y < inflate || p.x > ARENA.width - inflate || p.y > ARENA.height - inflate;
      const hit = nearWall || obstacles.some((o) => circleIntersectsRect(p, inflate, o));
      blocked[r * cols + c] = hit ? 1 : 0;
    }
  }
  return { cols, rows, cell, blocked };
}

export const inBounds = (g: NavGrid, c: number, r: number): boolean =>
  c >= 0 && r >= 0 && c < g.cols && r < g.rows;

export const isFree = (g: NavGrid, c: number, r: number): boolean =>
  inBounds(g, c, r) && g.blocked[r * g.cols + c] === 0;

export const cellOf = (g: NavGrid, p: Vec): Cell => ({
  c: Math.floor(p.x / g.cell),
  r: Math.floor(p.y / g.cell),
});

export const centerOf = (g: NavGrid, c: number, r: number): Vec => ({
  x: (c + 0.5) * g.cell,
  y: (r + 0.5) * g.cell,
});

export function freeCells(g: NavGrid): Cell[] {
  const out: Cell[] = [];
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) if (isFree(g, c, r)) out.push({ c, r });
  return out;
}

/** Count cells reachable from `start` (4-connected). */
export function floodCount(g: NavGrid, start: Cell): number {
  if (!isFree(g, start.c, start.r)) return 0;
  const seen = new Uint8Array(g.cols * g.rows);
  const stack = [start.r * g.cols + start.c];
  seen[stack[0] as number] = 1;
  let count = 0;
  while (stack.length > 0) {
    const i = stack.pop() as number;
    count++;
    const c = i % g.cols;
    const r = (i - c) / g.cols;
    for (const [dc, dr] of DIRS4) {
      const nc = c + dc;
      const nr = r + dr;
      const ni = nr * g.cols + nc;
      if (isFree(g, nc, nr) && !seen[ni]) {
        seen[ni] = 1;
        stack.push(ni);
      }
    }
  }
  return count;
}

/** Nearest free cell to a point (spiral search). */
export function nearestFree(g: NavGrid, p: Vec): Cell | null {
  const start = cellOf(g, p);
  const maxR = Math.max(g.cols, g.rows);
  for (let rad = 0; rad <= maxR; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== rad) continue;
        if (isFree(g, start.c + dc, start.r + dr)) return { c: start.c + dc, r: start.r + dr };
      }
    }
  }
  return null;
}

const DIRS4: ReadonlyArray<[number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIRS8: ReadonlyArray<[number, number]> = [
  ...DIRS4,
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Grid line-of-travel check by sampling at quarter-cell steps. */
export function gridClear(g: NavGrid, a: Vec, b: Vec): boolean {
  const d = dhypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(d / (g.cell * 0.25)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cell = cellOf(g, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    if (!isFree(g, cell.c, cell.r)) return false;
  }
  return true;
}

/** Binary min-heap keyed by f-score. */
class Heap {
  private items: Array<[number, number]> = [];
  get size(): number {
    return this.items.length;
  }
  push(key: number, val: number): void {
    const a = this.items;
    a.push([key, val]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if ((a[p] as [number, number])[0] <= key) break;
      [a[p], a[i]] = [a[i] as [number, number], a[p] as [number, number]];
      i = p;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0] as [number, number];
    const last = a.pop() as [number, number];
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && (a[l] as [number, number])[0] < (a[m] as [number, number])[0]) m = l;
        if (r < a.length && (a[r] as [number, number])[0] < (a[m] as [number, number])[0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i] as [number, number], a[m] as [number, number]];
        i = m;
      }
    }
    return top[1];
  }
}

/**
 * 8-directional A* without corner cutting, followed by string-pulling.
 * Returns world-space waypoints (excluding start), or [] if unreachable.
 */
export function findPath(g: NavGrid, from: Vec, to: Vec): Vec[] {
  const s = isFree(g, cellOf(g, from).c, cellOf(g, from).r) ? cellOf(g, from) : nearestFree(g, from);
  const t = isFree(g, cellOf(g, to).c, cellOf(g, to).r) ? cellOf(g, to) : nearestFree(g, to);
  if (!s || !t) return [];
  const n = g.cols * g.rows;
  const gScore = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const si = s.r * g.cols + s.c;
  const ti = t.r * g.cols + t.c;
  const h = (c: number, r: number): number => {
    const dx = Math.abs(c - t.c);
    const dy = Math.abs(r - t.r);
    return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
  };
  gScore[si] = 0;
  const open = new Heap();
  open.push(h(s.c, s.r), si);
  while (open.size > 0) {
    const i = open.pop();
    if (i === ti) break;
    if (closed[i]) continue;
    closed[i] = 1;
    const c = i % g.cols;
    const r = (i - c) / g.cols;
    for (const [dc, dr] of DIRS8) {
      const nc = c + dc;
      const nr = r + dr;
      if (!isFree(g, nc, nr)) continue;
      if (dc !== 0 && dr !== 0 && (!isFree(g, c + dc, r) || !isFree(g, c, r + dr))) continue;
      const ni = nr * g.cols + nc;
      const ng = (gScore[i] as number) + (dc !== 0 && dr !== 0 ? Math.SQRT2 : 1);
      if (ng < (gScore[ni] as number)) {
        gScore[ni] = ng;
        came[ni] = i;
        open.push(ng + h(nc, nr), ni);
      }
    }
  }
  if (si !== ti && came[ti] === -1) return [];
  const cells: Vec[] = [];
  for (let i = ti; i !== si; i = came[i] as number) {
    const c = i % g.cols;
    cells.push(centerOf(g, c, (i - c) / g.cols));
  }
  cells.reverse();
  const tc = cellOf(g, to);
  if (isFree(g, tc.c, tc.r)) cells.push(to);
  if (cells.length === 0) return [];
  return smooth(g, from, cells);
}

function smooth(g: NavGrid, from: Vec, pts: Vec[]): Vec[] {
  const out: Vec[] = [];
  let anchor = from;
  let i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !gridClear(g, anchor, pts[j] as Vec)) j--;
    out.push(pts[j] as Vec);
    anchor = pts[j] as Vec;
    i = j + 1;
  }
  return out;
}
