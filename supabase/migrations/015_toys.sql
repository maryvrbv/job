-- «Коллекция»: blind boxes for the job search. The app works out which boxes I earned from my own data
-- (rejections, stages, applications, sorted vacancies, active days, diary interviews and tests, milestones);
-- this table keeps only the opened ones: which figure fell out of each box, so a box never opens twice.
create table if not exists public.toy_boxes (
  key        text primary key,          -- what the box was for, e.g. 'rej:hh:123', 'day:2026-11-16', 'ms:app:10'
  series     text not null,             -- cats / dubai / spirits / monsters
  figure     text not null,             -- figure id inside the series
  opened_at  timestamptz not null default now()
);
alter table public.toy_boxes enable row level security;
create policy "owner manages toy boxes" on public.toy_boxes
  for all to authenticated using (true) with check (true);

-- a diary entry can say it was an interview or a test task: each of those brings a box
alter table public.diary add column if not exists kind text check (kind in ('interview', 'test'));
