import { z } from 'zod';
import type { EventRepository, NewEvent } from './repository.js';

export const MAX_BATCH = 50;
export const RATE_LIMIT_EVENTS_PER_MINUTE = 120;
/** Client clocks older than this (or ahead by more than CLOCK_SKEW_MS) are replaced with the server time. */
const MAX_EVENT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

type PropValue = string | number | boolean;
type PropNormalizer = (v: unknown) => PropValue | undefined;

const bool: PropNormalizer = (v) => (typeof v === 'boolean' ? v : undefined);
const str =
  (max: number): PropNormalizer =>
  (v) =>
    typeof v === 'string' ? v.slice(0, max) : undefined;
const num =
  (min: number, max: number, integer: boolean): PropNormalizer =>
  (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
    return Math.min(max, Math.max(min, integer ? Math.round(v) : v));
  };
const oneOf =
  (...allowed: string[]): PropNormalizer =>
  (v) =>
    typeof v === 'string' && allowed.includes(v) ? v : undefined;

const installKind = oneOf('prompt', 'ios', 'ios_in_app', 'android_in_app');
const installWhere = oneOf('title', 'over');
const mode = oneOf('classic', 'rush', 'night', 'campaign');
/** Campaign level number (1-based); absent outside the campaign. */
const level = num(1, 12, true);

/** eggs × 100 + 1200 s × 10, the most a 20-minute run can score. */
const MAX_SCORE = 10_000 * 100 + 1200 * 10;

/** Every event the client may send, with the props it may carry. Anything else is dropped. */
const CATALOGUE: Readonly<Record<string, Readonly<Record<string, PropNormalizer>>>> = {
  title_view: { installed: bool, referrer: str(64) },
  run_start: { seed: str(12), daily: bool, fromOver: bool, mode, level },
  run_end: {
    sec: num(0, 1200, false),
    eggs: num(0, 10_000, true),
    /** Ducklings banked (Season 1); feeds the "≥ 70 % of runs bank" gate. */
    banked: num(0, 10_000, true),
    score: num(0, MAX_SCORE, true),
    mode,
    level,
    nearMisses: num(0, 10_000, true),
    spottedCount: num(0, 10_000, true),
  },
  deathcam_skip: { at: num(0, 10, false) },
  mode_select: { mode },
  level_end: {
    level,
    cleared: bool,
    stars: num(0, 3, true),
    outcome: oneOf('cleared', 'caught', 'timeUp'),
  },
  retry: {},
  share: { via: oneOf('facebook', 'copy') },
  install: {},
  install_prompt_shown: { kind: installKind, where: installWhere },
  install_prompt_outcome: {
    kind: installKind,
    where: installWhere,
    outcome: oneOf('accepted', 'dismissed', 'opened', 'not_now'),
  },
  update_applied: { from: str(40), to: str(40) },
};

const BatchSchema = z.object({
  sessionId: z.uuid(),
  appVersion: z.string().regex(/^[A-Za-z0-9._-]{1,40}$/),
  platform: z.enum(['web']).default('web'),
  events: z
    .array(
      z.object({
        name: z.string().max(24),
        props: z.record(z.string(), z.unknown()).optional(),
        ts: z.number(),
      }),
    )
    .min(1)
    .max(MAX_BATCH),
});

export type EventBatch = z.infer<typeof BatchSchema>;

export interface NormalizedBatch {
  readonly sessionId: string;
  readonly appVersion: string;
  readonly platform: string;
  readonly events: readonly { name: string; props: Record<string, PropValue>; clientTs: string }[];
}

export function parseBatch(body: unknown): EventBatch | null {
  const parsed = BatchSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

function normalizeProps(
  spec: Readonly<Record<string, PropNormalizer>>,
  raw: Record<string, unknown> = {},
) {
  return Object.fromEntries(
    Object.entries(spec).flatMap(([key, normalize]) => {
      const value = normalize(raw[key]);
      return value === undefined ? [] : [[key, value]];
    }),
  ) as Record<string, PropValue>;
}

function plausibleTs(ts: number, now: Date): string {
  const t = now.getTime();
  return ts >= t - MAX_EVENT_AGE_MS && ts <= t + CLOCK_SKEW_MS
    ? new Date(ts).toISOString()
    : now.toISOString();
}

/** Drops unknown events and props, clamps numbers and truncates strings to the catalogue's limits. */
export function normalizeBatch(batch: EventBatch, now: Date): NormalizedBatch {
  const events = batch.events.flatMap((e) => {
    const spec = CATALOGUE[e.name];
    return spec
      ? [{ name: e.name, props: normalizeProps(spec, e.props), clientTs: plausibleTs(e.ts, now) }]
      : [];
  });
  return {
    sessionId: batch.sessionId,
    appVersion: batch.appVersion,
    platform: batch.platform,
    events,
  };
}

export type RecordOutcome =
  | { readonly ok: true; readonly result: { readonly accepted: number } }
  | { readonly ok: false; readonly status: number; readonly error: string };

/** Validate and store a batch of gameplay events. The bearer token is optional and never required. */
export async function recordEvents(
  repo: EventRepository,
  token: string | null,
  body: unknown,
  now: Date,
): Promise<RecordOutcome> {
  const parsed = parseBatch(body);
  if (!parsed) return { ok: false, status: 400, error: 'Invalid events batch' };
  const batch = normalizeBatch(parsed, now);
  if (batch.events.length === 0) return { ok: true, result: { accepted: 0 } };

  const since = new Date(now.getTime() - 60_000).toISOString();
  const recent = await repo.countSince(batch.sessionId, since);
  if (recent + batch.events.length > RATE_LIMIT_EVENTS_PER_MINUTE) {
    return { ok: false, status: 429, error: 'Too many events, slow down' };
  }

  const userId = token ? await repo.userIdForToken(token) : null;
  const rows: NewEvent[] = batch.events.map((e) => ({
    sessionId: batch.sessionId,
    userId,
    name: e.name,
    props: e.props,
    platform: batch.platform,
    appVersion: batch.appVersion,
    clientTs: e.clientTs,
  }));
  await repo.insertMany(rows);
  return { ok: true, result: { accepted: rows.length } };
}
