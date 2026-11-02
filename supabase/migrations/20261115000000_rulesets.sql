-- Rulesets (= seasons). Every score records the sim ruleset it was replayed under, and boards are
-- per season. Scores from before this migration are ruleset 0: the "Season 0" archive.
-- The API only accepts the current `RULESET` from src/config.ts.

alter table public.scores add column ruleset smallint not null default 0 check (ruleset >= 0);
-- Ducklings banked during the run (Season 1+), for share cards. 0 for Season 0.
alter table public.scores add column banked integer not null default 0 check (banked >= 0);

create index scores_ruleset_score_idx on public.scores (ruleset, score desc);
create index scores_ruleset_daily_idx on public.scores (ruleset, daily_date, score desc)
  where daily_date is not null;

-- One-row config. The service role writes it; anyone may read it.
create table public.app_config (
  id boolean primary key default true check (id),
  current_ruleset smallint not null check (current_ruleset >= 0)
);
-- Seeded at 0 so boards don't change before the Season 1 client ships. At deploy time run:
--   update public.app_config set current_ruleset = 1;
insert into public.app_config (current_ruleset) values (0);

alter table public.app_config enable row level security;
create policy "app config is public" on public.app_config for select using (true);
revoke insert, update, delete on public.app_config from anon, authenticated;
grant select on public.app_config to anon, authenticated;

-- Adding a parameter changes the signature, so the old functions are dropped and recreated.
-- `season` null = the current season from app_config; older clients call the 4-/5-arg forms.
drop function public.leaderboard(text, date, integer, text);
drop function public.rank_for(text, date, uuid, integer, text);

create function public.leaderboard(
  board text, day date default null, lim integer default 50, mode text default 'classic',
  season integer default null
)
returns table (
  rank bigint, user_id uuid, nickname text, avatar_url text,
  score integer, eggs integer, ticks integer, score_id uuid
)
language sql stable security invoker set search_path = '' as $$
  with cfg as (
    select coalesce(leaderboard.season, (select c.current_ruleset from public.app_config c)) as r
  ),
  best as (
    select distinct on (s.user_id) s.*
    from public.scores s, cfg
    where s.mode = leaderboard.mode
      and s.ruleset = cfg.r
      and ((board = 'all') or (board = 'daily' and s.daily_date = day))
    order by s.user_id, s.score desc, s.created_at asc
  )
  select rank() over (order by b.score desc), b.user_id, p.nickname, p.avatar_url,
         b.score, b.eggs, b.ticks, b.id
  from best b join public.profiles p on p.id = b.user_id
  order by b.score desc, b.created_at asc
  limit least(greatest(lim, 1), 100);
$$;

-- Rank a score would have on a mode's board in a season (1 = top), each other player's best once.
create function public.rank_for(
  board text, day date, player uuid, value integer, mode text default 'classic',
  season integer default null
)
returns bigint
language sql stable security invoker set search_path = '' as $$
  select 1 + count(*) from (
    select s.user_id, max(s.score) as best
    from public.scores s
    where s.user_id <> player
      and s.mode = rank_for.mode
      and s.ruleset = coalesce(rank_for.season, (select c.current_ruleset from public.app_config c))
      and ((board = 'all') or (board = 'daily' and s.daily_date = day))
    group by s.user_id
  ) others
  where others.best > value;
$$;

grant execute on function public.leaderboard(text, date, integer, text, integer) to anon, authenticated;
grant execute on function public.rank_for(text, date, uuid, integer, text, integer)
  to anon, authenticated, service_role;
