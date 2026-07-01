begin;

-- Public board-signing link (mirrors the partner signing token). Lets a board
-- member sign via a tokenized URL instead of an authenticated session.
alter table "public"."contract_submissions"
    add column if not exists "board_signature_token" text,
    add column if not exists "board_signature_token_expires_at" timestamptz;

create unique index if not exists "contract_submissions_board_signature_token_key"
    on "public"."contract_submissions" ("board_signature_token")
    where "board_signature_token" is not null;

commit;
