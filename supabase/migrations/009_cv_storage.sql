-- Private bucket for the base CVs (ru.pdf, en.pdf). The app downloads one, puts the vacancy's link tag
-- into its portfolio links and saves it under a neutral name. Only the signed-in user can read or replace them.
insert into storage.buckets (id, name, public) values ('cv', 'cv', false) on conflict (id) do nothing;
create policy "cv read" on storage.objects for select to authenticated using (bucket_id = 'cv');
create policy "cv upload" on storage.objects for insert to authenticated with check (bucket_id = 'cv');
create policy "cv replace" on storage.objects for update to authenticated using (bucket_id = 'cv') with check (bucket_id = 'cv');
-- "cv seed tmp" let the first upload go through without a session; it is switched off (dropping it hangs over MCP)
alter policy "cv seed tmp" on storage.objects with check (false);
