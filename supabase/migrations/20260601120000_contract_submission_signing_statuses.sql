begin;

alter table "public"."contract_submissions"
    add column if not exists "sent_to_partner_at" timestamptz,
    add column if not exists "partner_comment" text,
    add column if not exists "partner_commented_at" timestamptz,
    add column if not exists "final_pdf_token" text unique,
    add column if not exists "final_pdf_sent_at" timestamptz,
    add column if not exists "completed_at" timestamptz;

alter table "public"."contract_submissions"
    drop constraint if exists "contract_submissions_status_check";

alter table "public"."contract_submissions"
    add constraint "contract_submissions_status_check"
        check (
            "status" in (
                'draft',
                'submitted',
                'legal_review',
                'in_review',
                'approved',
                'rejected',
                'inquiry',
                'sent_to_partner',
                'partner_comments',
                'partner_signed',
                'board_signed',
                'signed',
                'completed'
            )
        );

commit;
