-- Time of a diary entry (local, Moscow). Entries written on their own day get it from created_at.
alter table public.diary add column if not exists at_time time;
update public.diary set at_time = date_trunc('minute', (created_at at time zone 'Europe/Moscow'))::time
  where at_time is null and (created_at at time zone 'Europe/Moscow')::date = day;
