-- 0003_storage.sql
--
-- Storage for the documents Convex currently keeps in its own `_storage`.
--
-- One private bucket, objects under `{auth uid}/...`. The first path segment is
-- the Supabase Auth user, so a policy can prove ownership from the path alone
-- without reading a table. Keeping the bucket private means a leaked URL is
-- useless: the app asks for a short-lived signed URL, exactly as
-- `supabase.signedUrl` does today for the service role.
--
-- Limits mirror `src/convex/lib/files.ts` (10 MB, PDF/PNG/JPEG/WebP/DOCX/text),
-- so an upload that the Convex path accepts is not rejected here and vice
-- versa.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "documents read own" on storage.objects;
create policy "documents read own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Staff need the same files to service a claim or issue a policy.
drop policy if exists "documents read staff" on storage.objects;
create policy "documents read staff"
  on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_staff());

drop policy if exists "documents write own" on storage.objects;
create policy "documents write own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents update own" on storage.objects;
create policy "documents update own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Deleting an object removes the file behind a document row, so it is left to
-- the service role (`storage.remove` from an edge function) rather than the
-- browser: the retention rules around closed accounts need the row and the
-- object to move together.

commit;
