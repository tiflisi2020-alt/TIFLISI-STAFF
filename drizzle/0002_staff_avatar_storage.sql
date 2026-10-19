-- Staff profile avatars in private Supabase Storage.
alter table public.tiflisi_profile_details
  add column if not exists avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff-avatars',
  'staff-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'staff avatars authenticated read') then
    create policy "staff avatars authenticated read" on storage.objects
      for select to authenticated using (bucket_id = 'staff-avatars');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'staff avatars own insert') then
    create policy "staff avatars own insert" on storage.objects
      for insert to authenticated
      with check (bucket_id = 'staff-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'staff avatars own update') then
    create policy "staff avatars own update" on storage.objects
      for update to authenticated
      using (bucket_id = 'staff-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text))
      with check (bucket_id = 'staff-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'staff avatars own delete') then
    create policy "staff avatars own delete" on storage.objects
      for delete to authenticated
      using (bucket_id = 'staff-avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
  end if;
end $$;
