// Single source of truth for the member CV size cap. Mirrors the DB
// size_bytes check constraint and the member-cvs storage bucket
// file_size_limit, which are kept in sync via Supabase migrations.
export const MAX_CV_MB = 10;
export const MAX_CV_BYTES = MAX_CV_MB * 1024 * 1024;
