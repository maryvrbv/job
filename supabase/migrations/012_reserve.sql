-- A vacancy put aside for later: it leaves «Откликнуться сегодня» and the market tabs and waits in «Резерв»
alter table public.jobs add column if not exists reserve boolean not null default false;
