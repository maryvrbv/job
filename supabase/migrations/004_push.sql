-- Push notifications: devices subscribe from the app, the notify function pushes at 12:00 and 20:00 MSK.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.push_subscriptions (
  endpoint     text primary key,
  subscription jsonb not null,
  created_at   timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "owner manages push subscriptions" on public.push_subscriptions;
create policy "owner manages push subscriptions" on public.push_subscriptions
  for all to authenticated using (true) with check (true);

-- One row per scheduled run: the next run counts vacancies created after the last sent_at
create table if not exists public.notify_log (
  id      bigserial primary key,
  sent_at timestamptz not null default now(),
  uae     int not null default 0,
  ru      int not null default 0,
  devices int not null default 0
);
alter table public.notify_log enable row level security;
drop policy if exists "owner reads notify log" on public.notify_log;
create policy "owner reads notify log" on public.notify_log for select to authenticated using (true);

-- VAPID keys and the cron secret. No policies: only the service role (the function) and postgres read it.
-- Values are inserted outside of git.
create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;

select cron.schedule('notify-vacancies', '0 9,17 * * *', $$
  select net.http_post(
    url := 'https://iiaqpkynritnvcwjhooh.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select value from public.app_secrets where name = 'cron_secret')),
    body := '{}'::jsonb)
$$);
