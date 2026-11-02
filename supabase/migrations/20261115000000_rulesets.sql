-- Rulesets and Duckling Dash. Every score records the sim ruleset it was replayed under (the API
-- only accepts the current `RULESET` from src/config.ts); scores from before this migration are
-- ruleset 0. Boards stay per mode: Classic keeps its scores.

alter table public.scores add column ruleset smallint not null default 0 check (ruleset >= 0);
-- Ducklings banked during the run (Duckling Dash and duckling campaign levels), for share cards.
alter table public.scores add column banked integer not null default 0 check (banked >= 0);

-- Night Swamp folded into Classic's day/night cycle: its rows stay, but no client asks for its
-- board any more. Duckling Dash is the new ranked mode.
alter table public.scores drop constraint scores_mode_check;
alter table public.scores add constraint scores_mode_check
  check (mode in ('classic', 'rush', 'night', 'ducklings'));
