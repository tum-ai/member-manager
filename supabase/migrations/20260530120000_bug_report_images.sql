begin;

-- =========================================================================
-- Bug-report screenshots: a PUBLIC Supabase Storage bucket.
--
-- Screenshots pasted into the in-app "Report a bug" dialog are embedded in the
-- GitHub issue the server opens. GitHub's image proxy (camo) fetches the URL
-- server-side with no Supabase credentials, so the object must be publicly
-- readable to render. Object paths are unguessable UUIDs and all uploads go
-- through the server (service role) — the same way member CVs are written.
--
-- Source of truth for the bucket lives here so local (`supabase db reset`) and
-- prod (`supabase db push`) stay in parity. `config.toml` only sets local-dev
-- limits. Images only, 10 MB cap enforced both here and in the API layer.
-- =========================================================================
insert into "storage"."buckets" (
    "id", "name", "public", "file_size_limit", "allowed_mime_types"
)
values (
    'bug-report-images',
    'bug-report-images',
    true,
    10485760, -- 10 MiB
    array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict ("id") do update set
    "public" = excluded."public",
    "file_size_limit" = excluded."file_size_limit",
    "allowed_mime_types" = excluded."allowed_mime_types";

-- No storage.objects RLS policies are added: uploads are mediated by the server
-- using the service role. Public reads are served via the bucket's public URLs.

commit;
