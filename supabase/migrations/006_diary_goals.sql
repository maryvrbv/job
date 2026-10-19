-- A diary entry can be a goal with a priority; a reached goal is marked done and moves into the log.
alter table public.diary add column if not exists is_goal boolean not null default false;
alter table public.diary add column if not exists priority text check (priority in ('high', 'mid', 'low'));
alter table public.diary add column if not exists done boolean not null default false;
