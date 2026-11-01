-- Game modes: every score belongs to one ranked mode, and each mode has its own board.
-- Existing scores are classic. The daily board stays classic-only (enforced by the API).

alter table public.scores
  add column mode text not null default 'classic'
  check (mode in ('classic', 'rush', 'night'));
-- The Daily Swamp is classic-only; the API enforces it and this keeps the data honest too.
alter table public.scores
  add constraint scores_daily_classic_only check (mode = 'classic' or daily_date is null);

create index scores_mode_score_idx on public.scores (mode, score desc);
create index scores_mode_daily_idx on public.scores (mode, daily_date, score desc) where daily_date is not null;

-- Adding a parameter changes the signature, so the old functions are replaced, not altered.
-- `mode` defaults to classic: clients built before this migration call the 3-/4-argument forms.
drop function public.leaderboard(text, date, integer);
drop function public.rank_for(text, date, uuid, integer);

create function public.leaderboard(
  board text, day date default null, lim integer default 50, mode text default 'classic'
)
returns table (
  rank bigint, user_id uuid, nickname text, avatar_url text,
  score integer, eggs integer, ticks integer, score_id uuid
)
language sql stable security invoker set search_path = '' as $$
  with best as (
    select distinct on (s.user_id) s.*
    from public.scores s
    where s.mode = leaderboard.mode
      and ((board = 'all') or (board = 'daily' and s.daily_date = day))
    order by s.user_id, s.score desc, s.created_at asc
  )
  select rank() over (order by b.score desc), b.user_id, p.nickname, p.avatar_url,
         b.score, b.eggs, b.ticks, b.id
  from best b join public.profiles p on p.id = b.user_id
  order by b.score desc, b.created_at asc
  limit least(greatest(lim, 1), 100);
$$;

-- Rank a score would have on a mode's board (1 = top), counting each other player's best once.
create function public.rank_for(
  board text, day date, player uuid, value integer, mode text default 'classic'
)
returns bigint
language sql stable security invoker set search_path = '' as $$
  select 1 + count(*) from (
    select s.user_id, max(s.score) as best
    from public.scores s
    where s.user_id <> player
      and s.mode = rank_for.mode
      and ((board = 'all') or (board = 'daily' and s.daily_date = day))
    group by s.user_id
  ) others
  where others.best > value;
$$;

grant execute on function public.leaderboard(text, date, integer, text) to anon, authenticated;
grant execute on function public.rank_for(text, date, uuid, integer, text) to anon, authenticated, service_role;
