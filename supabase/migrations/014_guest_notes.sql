-- «Портфолио»: Masha links a guest to the vacancy she thinks they came from, by hand, with a comment.
-- Keyed by the guest's analytics mark (the random id the site keeps in the browser), so the link survives
-- a guest getting another Harry Potter name. Manual links are shown apart from links that came from a URL tag.
create table if not exists public.guest_notes (
  mark       text primary key,
  name       text not null default '',
  job_id     text references public.jobs(id) on delete set null,
  comment    text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.guest_notes enable row level security;
create policy "owner manages guest notes" on public.guest_notes
  for all to authenticated using (true) with check (true);
