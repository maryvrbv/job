-- Who changed the status: by_me is true when a signed-in user did it in the app, false for the update scripts
-- (service role / SQL). Older rows were all made in the app.
alter table public.job_events add column if not exists by_me boolean not null default true;
create or replace function public.jobs_touch() returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into public.job_events (job_id, from_status, to_status, by_me) values (new.id, old.status, new.status, auth.uid() is not null);
  end if;
  return new;
end $fn$;
