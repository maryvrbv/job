-- «Дорогой дневник»: what I did for the job search, day by day. Started in the «Собесы» sheet.
create table if not exists public.diary (
  id         bigserial primary key,
  day        date not null default current_date,
  text       text not null,
  created_at timestamptz not null default now()
);
create index if not exists diary_day on public.diary (day desc, id desc);
alter table public.diary enable row level security;
create policy "owner manages diary" on public.diary
  for all to authenticated using (true) with check (true);
