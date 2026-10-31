-- Gator Gotcha leaderboard: player profiles + server-verified scores.
-- Scores are only ever written by the Vercel replay validator using the service role.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (nickname ~ '^[A-Za-z0-9_ ]{3,16}$'),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  created_at timestamptz not null default now()
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  seed text not null check (seed ~ '^[a-z0-9]{1,12}$'),
  daily_date date,
  score integer not null check (score >= 0),
  eggs integer not null check (eggs >= 0),
  ticks integer not null check (ticks > 0),
  input_hash text not null,
  created_at timestamptz not null default now(),
  unique (user_id, input_hash)
);

create index scores_score_idx on public.scores (score desc);
create index scores_daily_idx on public.scores (daily_date, score desc) where daily_date is not null;
create index scores_user_recent_idx on public.scores (user_id, created_at desc);

-- ---------- Nickname guard ----------
create function public.nickname_allowed(n text) returns boolean
language sql immutable as $$
  select not (lower(regexp_replace(n, '[^a-z0-9]', '', 'gi')) ~
    '(fuck|shit|cunt|bitch|nigg|faggot|nazi|whore|slut|pussy|tangina|kupal|gago)');
$$;

alter table public.profiles add constraint profiles_nickname_clean check (public.nickname_allowed(nickname));

-- ---------- Auto-create a profile for every new auth user (incl. anonymous) ----------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, 'Duck' || lpad((floor(random() * 10000))::int::text, 4, '0'));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row level security ----------
alter table public.profiles enable row level security;
alter table public.scores enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "players update own profile" on public.profiles for update
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "scores are public" on public.scores for select using (true);
-- No insert/update/delete policies on scores: only the service role (replay validator) writes.

revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (nickname) on public.profiles to authenticated;
revoke insert, update, delete on public.scores from anon, authenticated;

-- ---------- Leaderboards ----------
-- board: 'all' (best score per player, all time) or 'daily' (best per player for `day`).
create function public.leaderboard(board text, day date default null, lim integer default 50)
returns table (
  rank bigint, user_id uuid, nickname text, avatar_url text,
  score integer, eggs integer, ticks integer, score_id uuid
)
language sql stable security invoker set search_path = '' as $$
  with best as (
    select distinct on (s.user_id) s.*
    from public.scores s
    where (board = 'all') or (board = 'daily' and s.daily_date = day)
    order by s.user_id, s.score desc, s.created_at asc
  )
  select rank() over (order by b.score desc), b.user_id, p.nickname, p.avatar_url,
         b.score, b.eggs, b.ticks, b.id
  from best b join public.profiles p on p.id = b.user_id
  order by b.score desc, b.created_at asc
  limit least(greatest(lim, 1), 100);
$$;

-- Rank a score would have on a board (1 = top), counting each other player's best once.
create function public.rank_for(board text, day date, player uuid, value integer)
returns bigint
language sql stable security invoker set search_path = '' as $$
  select 1 + count(*) from (
    select s.user_id, max(s.score) as best
    from public.scores s
    where s.user_id <> player
      and ((board = 'all') or (board = 'daily' and s.daily_date = day))
    group by s.user_id
  ) others
  where others.best > value;
$$;

grant execute on function public.leaderboard(text, date, integer) to anon, authenticated;
grant execute on function public.rank_for(text, date, uuid, integer) to anon, authenticated, service_role;
