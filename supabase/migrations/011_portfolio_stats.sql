-- Google Analytics snapshot for the «Портфолио» view; Claude writes it (ingest/portfolio_stats.py), the app only reads
create table if not exists public.portfolio_stats (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
alter table public.portfolio_stats enable row level security;
create policy "portfolio stats read" on public.portfolio_stats for select to authenticated using (true);
