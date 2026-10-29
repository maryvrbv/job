-- Private bucket for guest avatars in «Портфолио»: Masha picks a picture for a character (Harry Potter names
-- given to returning visitors), saved as <transliterated name>.jpg. Only the signed-in user can read or replace them.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', false) on conflict (id) do nothing;
create policy "avatars read" on storage.objects for select to authenticated using (bucket_id = 'avatars');
create policy "avatars upload" on storage.objects for insert to authenticated with check (bucket_id = 'avatars');
create policy "avatars replace" on storage.objects for update to authenticated using (bucket_id = 'avatars') with check (bucket_id = 'avatars');
