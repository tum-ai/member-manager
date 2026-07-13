begin;

-- Round 2 Nr.11: opt-in auto-send. When enabled, the board signature
-- automatically finalizes the contract and emails the partner the final PDF
-- link instead of waiting for the manual "Generate final PDF link" flow.
alter table "public"."contract_submissions"
    add column if not exists "auto_send_after_board_signed" boolean not null default false;

commit;
