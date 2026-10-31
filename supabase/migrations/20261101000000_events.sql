-- Gator Gotcha first-party analytics: gameplay events written only by /api/events (service role).
-- Clients can neither read nor write the table or its views. Days are UTC, matching the daily seed.

create table public.events (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  user_id uuid null references public.profiles (id) on delete set null,
  name text not null check (name ~ '^[a-z_]{3,24}$'),
  props jsonb not null default '{}' check (pg_column_size(props) < 1024),
  platform text not null default 'web',
  app_version text not null,
  client_ts timestamptz not null,
  created_at timestamptz not null default now()
);

create index events_created_idx on public.events (created_at);
create index events_user_created_idx on public.events (user_id, created_at);
create index events_session_idx on public.events (session_id);

alter table public.events enable row level security;
-- No policies: only the service role (which bypasses RLS) touches this table.
revoke all on public.events from anon, authenticated;

-- ---------- Views (service role only) ----------

-- Daily players (by account), sessions (page loads) and finished runs.
create view public.events_daily_active with (security_invoker = true) as
select
  (created_at at time zone 'utc')::date as day,
  count(distinct user_id) as players,
  count(distinct session_id) as sessions,
  count(*) filter (where name = 'run_end') as runs
from public.events
group by 1;

-- D1 / D7 retention by first-seen cohort day. Only events with an account (user_id) count:
-- an anonymous account is created on a player's first submitted run.
create view public.events_retention with (security_invoker = true) as
with active as (
  select distinct user_id, (created_at at time zone 'utc')::date as day
  from public.events
  where user_id is not null
),
cohorts as (
  select user_id, min(day) as cohort_day from active group by user_id
)
select
  c.cohort_day,
  count(*) as players,
  count(d1.user_id) as d1,
  count(d7.user_id) as d7,
  round(100.0 * count(d1.user_id) / count(*), 1) as d1_pct,
  round(100.0 * count(d7.user_id) / count(*), 1) as d7_pct
from cohorts c
left join active d1 on d1.user_id = c.user_id and d1.day = c.cohort_day + 1
left join active d7 on d7.user_id = c.user_id and d7.day = c.cohort_day + 7
group by c.cohort_day;

-- Runs and retries per session (page load).
create view public.events_session_runs with (security_invoker = true) as
select
  session_id,
  max(user_id::text)::uuid as user_id,
  min(created_at) as started_at,
  count(*) filter (where name = 'run_start') as runs,
  count(*) filter (where name = 'retry') as retries,
  count(*) filter (where name = 'run_end') as finished
from public.events
group by session_id;

-- Time-to-death histogram in 10-second buckets.
create view public.events_death_histogram with (security_invoker = true) as
select
  (floor((props ->> 'sec')::numeric / 10) * 10)::int as bucket_sec,
  count(*) as runs
from public.events
where name = 'run_end' and props ? 'sec'
group by 1;

revoke all on public.events_daily_active, public.events_retention,
  public.events_session_runs, public.events_death_histogram from anon, authenticated;
