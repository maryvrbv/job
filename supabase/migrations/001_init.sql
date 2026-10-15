-- Job tracker: one row per vacancy, my progress lives on the same row.
-- The ingest job only ever inserts new rows (on conflict do nothing),
-- so it never touches status, letters or feedback.

create table if not exists public.jobs (
  id            text primary key,              -- 'li:4479546331' / 'hh:138313879'
  market        text not null check (market in ('uae', 'ru')),
  url           text not null,
  title         text not null,
  company       text not null default '',
  city          text not null default '',
  work_format   text not null default '',      -- 'удалёнка, гибрид', 'офис', 'не указан'
  salary        text not null default '',
  experience    text not null default '',
  posted_at     date,
  applicants    text not null default '',
  domain        text not null default '',
  level         text not null default '',
  fit           text not null default 'Средний' check (fit in ('Высокий', 'Средний', 'Низкий')),
  why           text not null default '',
  description   text not null default '',

  status        text not null default 'Не откликалась' check (status in (
                  'Не откликалась', 'Откликнулась', 'Написала рекрутеру', 'Скрининг с HR',
                  'Собес с лидом', 'Тестовое', 'Финальный собес', 'Оффер', 'Отказ', 'Не подходит')),
  applied_at    date,
  reject_stage  text not null default '',
  feedback      text not null default '',
  skip_reason   text not null default '',
  comment       text not null default '',
  letter        text not null default '',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists jobs_posted_idx on public.jobs (posted_at desc);

-- Every status change is logged, so the funnel can show how long each stage took
create table if not exists public.job_events (
  id          bigserial primary key,
  job_id      text not null references public.jobs (id) on delete cascade,
  from_status text,
  to_status   text not null,
  at          timestamptz not null default now()
);

create or replace function public.jobs_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.job_events (job_id, from_status, to_status) values (new.id, old.status, new.status);
  end if;
  return new;
end $$;

drop trigger if exists jobs_touch on public.jobs;
create trigger jobs_touch before update on public.jobs
  for each row execute function public.jobs_touch();

-- Access: only signed-in users. After your first sign-in, turn off
-- "Allow new users to sign up" in Authentication settings, so you stay the only user.
alter table public.jobs enable row level security;
alter table public.job_events enable row level security;

drop policy if exists "owner reads and writes jobs" on public.jobs;
create policy "owner reads and writes jobs" on public.jobs
  for all to authenticated using (true) with check (true);

drop policy if exists "owner reads events" on public.job_events;
create policy "owner reads events" on public.job_events
  for select to authenticated using (true);
