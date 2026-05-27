-- Seed data for local development
-- This file runs after migrations when you run `supabase db reset`

-- Create test users in auth.users
-- Note: In local development, you can also create users via the Supabase Studio UI
-- or use the Auth API. These are seeded for convenience.

-- Insert test auth users.
--
-- GoTrue's Go driver scans several nullable VARCHAR columns in auth.users
-- (confirmation_token, recovery_token, email_change_token_new, email_change)
-- as plain Go strings and crashes with "converting NULL to string is
-- unsupported" on login if they are left NULL. The DB has no DEFAULT '' for
-- those columns, so we must pass empty strings explicitly.
do $$
begin
    create temporary table seed_users_local (
        id uuid primary key,
        email text not null unique,
        given_name text not null,
        surname text not null,
        batch text,
        department text,
        member_role text not null,
        board_role text,
        degree text,
        school text,
        access_role text not null default 'user'
    ) on commit drop;

    -- All local seed users share the password `password123`.
    insert into seed_users_local (
        id,
        email,
        given_name,
        surname,
        batch,
        department,
        member_role,
        board_role,
        degree,
        school,
        access_role
    ) values
        ('00000000-0000-0000-0000-000000000001', 'admin@example.com', 'Ada', 'President', 'WS22', 'Legal & Finance', 'President', null, 'PhD', 'TUM', 'admin'),
        ('00000000-0000-0000-0000-000000000002', 'vice-president@example.com', 'Vera', 'Vice', 'SS23', 'Community', 'Vice-President', null, 'M.Sc. Management & Technology', 'TUM', 'admin'),
        ('00000000-0000-0000-0000-000000000003', 'board-lead@example.com', 'Bianca', 'Boardlead', 'WS23', 'Software Development', 'Team Lead', 'Board Member', 'M.Sc. Management & Technology', 'LMU', 'user'),
        ('00000000-0000-0000-0000-000000000004', 'board-member@example.com', 'Ben', 'Boardmember', 'SS24', 'Software Development', 'Member', 'Board Member', 'B.Sc. Computer Science', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000005', 'community-lead@example.com', 'Clara', 'Community', 'WS23', 'Community', 'Team Lead', null, 'M.Sc. Management & Technology', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000006', 'regular-member@example.com', 'Regular', 'Member', null, null, 'Member', null, null, null, 'user'),
        ('00000000-0000-0000-0000-000000000007', 'innovation-lead@example.com', 'Ines', 'Innovation', 'WS23', 'Innovation Department', 'Team Lead', null, 'M.Sc. Management & Technology', 'LMU', 'user'),
        ('00000000-0000-0000-0000-000000000008', 'innovation-member@example.com', 'Ian', 'Innovation', 'SS24', 'Innovation Department', 'Member', null, 'B.Sc. Management & Technology', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000009', 'legal-finance-lead@example.com', 'Lea', 'Finance', 'WS23', 'Legal & Finance', 'Team Lead', 'Board Member', 'M.Sc. Management & Technology', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000010', 'legal-finance-member@example.com', 'Luca', 'Finance', 'SS24', 'Legal & Finance', 'Member', null, 'B.Sc. Management & Technology', 'LMU', 'user'),
        ('00000000-0000-0000-0000-000000000011', 'makeathon-lead@example.com', 'Maya', 'Makeathon', 'WS23', 'Makeathon', 'Team Lead', null, 'M.Sc. Computer Science', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000012', 'makeathon-member@example.com', 'Max', 'Makeathon', 'SS24', 'Makeathon', 'Member', null, 'B.Sc. Computer Science', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000013', 'marketing-lead@example.com', 'Mina', 'Marketing', 'WS23', 'Marketing', 'Team Lead', null, 'M.Sc. Management & Technology', 'LMU', 'user'),
        ('00000000-0000-0000-0000-000000000014', 'marketing-member@example.com', 'Milo', 'Marketing', 'SS24', 'Marketing', 'Member', null, 'B.Sc. Management & Technology', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000015', 'partners-sponsors-lead@example.com', 'Paula', 'Partners', 'WS23', 'Partners & Sponsors', 'Team Lead', null, 'M.Sc. Management & Technology', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000016', 'partners-sponsors-member@example.com', 'Peter', 'Partners', 'SS24', 'Partners & Sponsors', 'Member', null, 'B.Sc. Management & Technology', 'LMU', 'user'),
        ('00000000-0000-0000-0000-000000000017', 'research-lead@example.com', 'Rita', 'Research', 'WS23', 'Research', 'Member', null, 'PhD', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000018', 'research-member@example.com', 'Robin', 'Research', 'SS24', 'Research', 'Member', null, 'M.Sc. Computer Science', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000019', 'software-development-lead@example.com', 'Sofia', 'Software', 'WS23', 'Software Development', 'Team Lead', null, 'M.Sc. Computer Science', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000020', 'user@example.com', 'Regular', 'User', 'SS24', 'Software Development', 'Member', null, 'B.Sc. Computer Science', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000021', 'venture-lead@example.com', 'Valerie', 'Venture', 'WS23', 'Venture', 'Team Lead', null, 'M.Sc. Management & Technology', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000022', 'venture-member@example.com', 'Victor', 'Venture', 'SS24', 'Venture', 'Member', null, 'B.Sc. Management & Technology', 'LMU', 'user');

    insert into auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        aud,
        role,
        confirmation_token,
        recovery_token,
        email_change_token_new,
        email_change
    )
    select
        seed.id,
        '00000000-0000-0000-0000-000000000000',
        seed.email,
        extensions.crypt('password123', extensions.gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider": "email", "providers": ["email"]}',
        jsonb_build_object(
            'given_name', seed.given_name,
            'family_name', seed.surname,
            'name', seed.given_name || ' ' || seed.surname
        ),
        'authenticated',
        'authenticated',
        '',
        '',
        '',
        ''
    from seed_users_local seed
    on conflict (id) do nothing;

-- Matching identity rows so Supabase Auth can resolve the email provider.
    insert into auth.identities (
        id,
        user_id,
        provider,
        provider_id,
        identity_data,
        last_sign_in_at,
        created_at,
        updated_at
    )
    select
        gen_random_uuid(),
        seed.id,
        'email',
        seed.id::text,
        jsonb_build_object(
            'sub', seed.id::text,
            'email', seed.email,
            'email_verified', true,
            'provider', 'email'
        ),
        now(),
        now(),
        now()
    from seed_users_local seed
    on conflict (provider, provider_id) do nothing;

-- Seed member profiles
    insert into public.members (
        user_id,
        given_name,
        surname,
        salutation,
        title,
        date_of_birth,
        street,
        number,
        postal_code,
        city,
        country,
        active,
        batch,
        department,
        member_role,
        board_role,
        degree,
        school
    )
    select
        seed.id,
        seed.given_name,
        seed.surname,
        'Mx.',
        '',
        '1995-01-01',
        'Seed Lane',
        '1',
        '80333',
        'Munich',
        'Germany',
        true,
        seed.batch,
        seed.department,
        seed.member_role,
        seed.board_role,
        seed.degree,
        seed.school
    from seed_users_local seed
    on conflict (user_id) do update set
        given_name = excluded.given_name,
        surname = excluded.surname,
        salutation = excluded.salutation,
        title = excluded.title,
        date_of_birth = excluded.date_of_birth,
        street = excluded.street,
        number = excluded.number,
        postal_code = excluded.postal_code,
        city = excluded.city,
        country = excluded.country,
        active = excluded.active,
        batch = excluded.batch,
        department = excluded.department,
        member_role = excluded.member_role,
        board_role = excluded.board_role,
        degree = excluded.degree,
        school = excluded.school;

-- Seed user roles
    insert into public.user_roles (user_id, role)
    select seed.id, seed.access_role
    from seed_users_local seed
    on conflict (user_id) do update set
        role = excluded.role;
end $$;

-- Add local inspection data that exercises status filters, LinkedIn/location
-- fields, research projects, and admin-managed profile edits.
update public.members as member
set
    phone = seed.phone,
    member_status = seed.member_status,
    active = (seed.member_status = 'active'),
    research_project_id = seed.research_project_id,
    linkedin_profile_url = seed.linkedin_profile_url,
    public_location = seed.public_location
from (
    values
        ('00000000-0000-0000-0000-000000000001'::uuid, '+4915110000001', 'active', null, 'https://linkedin.com/in/ada-president', 'Munich, Germany'),
        ('00000000-0000-0000-0000-000000000003'::uuid, '+4915110000003', 'active', null, 'https://linkedin.com/in/bianca-boardlead', 'Garching, Germany'),
        ('00000000-0000-0000-0000-000000000006'::uuid, null, 'active', null, null, null),
        ('00000000-0000-0000-0000-000000000009'::uuid, '+4915110000009', 'active', null, 'https://linkedin.com/in/lea-finance', 'Munich, Germany'),
        ('00000000-0000-0000-0000-000000000011'::uuid, '+4915110000011', 'active', null, 'https://linkedin.com/in/maya-makeathon', 'Munich, Germany'),
        ('00000000-0000-0000-0000-000000000017'::uuid, '+4915110000017', 'active', 'applied-ai-research', 'https://linkedin.com/in/rita-research', 'Munich, Germany'),
        ('00000000-0000-0000-0000-000000000018'::uuid, '+4915110000018', 'alumni', 'robotics-lab', 'https://linkedin.com/in/robin-research', 'Berlin, Germany'),
        ('00000000-0000-0000-0000-000000000020'::uuid, '+4915110000020', 'active', null, 'https://linkedin.com/in/regular-user', 'Munich, Germany'),
        ('00000000-0000-0000-0000-000000000022'::uuid, null, 'inactive', null, null, 'Remote')
) as seed(user_id, phone, member_status, research_project_id, linkedin_profile_url, public_location)
where member.user_id = seed.user_id;

-- Seed SEPA data for local test accounts. The regular user, finance reviewer,
-- and admin have bank details so reimbursement and admin flows can be tested
-- immediately after `pnpm dev` / `pnpm supabase:reset`.
insert into public.sepa (
    user_id,
    iban,
    bic,
    bank_name,
    mandate_agreed,
    privacy_agreed
) values
    (
        '00000000-0000-0000-0000-000000000001',
        'DE89370400440532013000',
        'COBADEFFXXX',
        'Commerzbank',
        true,
        true
    ),
    (
        '00000000-0000-0000-0000-000000000009',
        'DE12500105170648489890',
        'INGDDEFFXXX',
        'ING-DiBa',
        true,
        true
    ),
    (
        '00000000-0000-0000-0000-000000000011',
        'DE89370400440532013000',
        'COBADEFFXXX',
        'Commerzbank',
        true,
        true
    ),
    (
        '00000000-0000-0000-0000-000000000020',
        'DE89370400440532013000',
        'COBADEFFXXX',
        'Commerzbank',
        true,
        true
    )
on conflict (user_id) do update set
    iban = excluded.iban,
    bic = excluded.bic,
    bank_name = excluded.bank_name,
    mandate_agreed = excluded.mandate_agreed,
    privacy_agreed = excluded.privacy_agreed;

-- Seed agreement data for local test accounts.
insert into public.member_agreements (
    user_id,
    sepa_mandate_agreed,
    privacy_policy_agreed,
    data_privacy_notice_agreed
) values
    (
        '00000000-0000-0000-0000-000000000001',
        true,
        true,
        true
    ),
    (
        '00000000-0000-0000-0000-000000000009',
        true,
        true,
        true
    ),
    (
        '00000000-0000-0000-0000-000000000011',
        true,
        true,
        true
    ),
    (
        '00000000-0000-0000-0000-000000000020',
        true,
        true,
        true
    )
on conflict (user_id) do update set
    sepa_mandate_agreed = excluded.sepa_mandate_agreed,
    privacy_policy_agreed = excluded.privacy_policy_agreed,
    data_privacy_notice_agreed = excluded.data_privacy_notice_agreed,
    updated_at = now();

-- Seed role-history examples for the certificate and admin history views.
insert into public.member_role_history (
    id,
    user_id,
    role,
    semester,
    started_at,
    ended_at,
    note,
    created_by
) values
    (
        '10000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000020',
        'Member',
        'SS24',
        '2024-04-01',
        '2024-09-30',
        'Joined Software Development as an active contributor.',
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003',
        'Team Lead',
        'WS24/25',
        '2024-10-01',
        null,
        'Leads platform tooling and member manager workstreams.',
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        '10000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000018',
        'Alumni',
        'SS25',
        '2025-04-01',
        null,
        'Alumni after completing research project handover.',
        '00000000-0000-0000-0000-000000000001'
    )
on conflict (id) do update set
    user_id = excluded.user_id,
    role = excluded.role,
    semester = excluded.semester,
    started_at = excluded.started_at,
    ended_at = excluded.ended_at,
    note = excluded.note,
    created_by = excluded.created_by;

-- Seed member-change requests covering pending, approved, and rejected states.
insert into public.member_change_requests (
    id,
    user_id,
    status,
    changes,
    reason,
    review_note,
    reviewed_by,
    reviewed_at,
    created_at
) values
    (
        '20000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000020',
        'pending',
        '{"department": "Research", "degree": "M.Sc. Computer Science"}'::jsonb,
        'I joined the applied AI research group this semester.',
        null,
        null,
        null,
        now() - interval '2 days'
    ),
    (
        '20000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000018',
        'approved',
        '{"member_status": "alumni"}'::jsonb,
        'Graduated and moved into alumni status.',
        'Approved for local inspection data.',
        '00000000-0000-0000-0000-000000000001',
        now() - interval '5 days',
        now() - interval '7 days'
    ),
    (
        '20000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000006',
        'rejected',
        '{"member_role": "Team Lead", "department": "Software Development"}'::jsonb,
        'Testing rejected review copy in the admin queue.',
        'Team lead changes require board confirmation.',
        '00000000-0000-0000-0000-000000000001',
        now() - interval '1 day',
        now() - interval '3 days'
    )
on conflict (id) do update set
    user_id = excluded.user_id,
    status = excluded.status,
    changes = excluded.changes,
    reason = excluded.reason,
    review_note = excluded.review_note,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    created_at = excluded.created_at;

-- Seed engagement-certificate approval states.
insert into public.engagement_certificate_requests (
    id,
    user_id,
    status,
    engagements,
    review_note,
    reviewed_by,
    reviewed_at,
    created_at
) values
    (
        '30000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000020',
        'pending',
        '[{"id":"seed-engagement-1","startDate":"2024-04-01","endDate":"","isStillActive":true,"weeklyHours":"5","department":"Software Development","isTeamLead":false,"tasksDescription":"Built internal member-management tooling and fixed production support issues."}]'::jsonb,
        null,
        null,
        null,
        now() - interval '1 day'
    ),
    (
        '30000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003',
        'approved',
        '[{"id":"seed-engagement-2","startDate":"2023-10-01","endDate":"2025-03-31","isStillActive":false,"weeklyHours":"10","department":"Software Development","isTeamLead":true,"specialRole":"Board Member","tasksDescription":"Led platform architecture, mentored contributors, and represented the team on the board."}]'::jsonb,
        'Approved for local certificate download testing.',
        '00000000-0000-0000-0000-000000000001',
        now() - interval '4 days',
        now() - interval '6 days'
    ),
    (
        '30000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000006',
        'rejected',
        '[{"id":"seed-engagement-3","startDate":"2024-10-01","endDate":"2025-03-31","isStillActive":false,"weeklyHours":"2","department":"Community","isTeamLead":false,"tasksDescription":"Draft request with intentionally incomplete evidence for rejected-state UI."}]'::jsonb,
        'Please add a more specific task description before resubmitting.',
        '00000000-0000-0000-0000-000000000001',
        now() - interval '2 days',
        now() - interval '3 days'
    )
on conflict (id) do update set
    user_id = excluded.user_id,
    status = excluded.status,
    engagements = excluded.engagements,
    review_note = excluded.review_note,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    created_at = excluded.created_at;

-- Seed reimbursement review states with tiny placeholder PDF payloads.
insert into public.reimbursements (
    id,
    user_id,
    amount,
    date,
    description,
    department,
    submission_type,
    payment_iban,
    payment_bic,
    receipt_filename,
    receipt_mime_type,
    receipt_base64,
    status,
    approval_status,
    payment_status,
    rejection_reason,
    created_at,
    updated_at,
    bb_sync_status,
    bb_receipt_id_by_customer,
    bb_receipt_filename,
    bb_synced_at,
    bb_sync_attempts,
    bb_last_sync_attempt_at,
    bb_synced_by
) values
    (
        '40000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000020',
        42.50,
        current_date - 12,
        'Train ticket to Munich AI meetup',
        'Software Development',
        'reimbursement',
        'DE89370400440532013000',
        'COBADEFFXXX',
        'train-ticket.pdf',
        'application/pdf',
        'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyA+PgplbmRvYmoKdHJhaWxlcgo8PCAvUm9vdCAxIDAgUiA+PgolJUVPRgo=',
        'requested',
        'pending',
        'to_be_paid',
        null,
        now() - interval '12 days',
        now() - interval '12 days',
        'not_synced',
        null,
        null,
        null,
        0,
        null,
        null
    ),
    (
        '40000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000011',
        128.90,
        current_date - 22,
        'Makeathon prototype materials',
        'Makeathon',
        'invoice',
        'DE89370400440532013000',
        'COBADEFFXXX',
        'prototype-materials.pdf',
        'application/pdf',
        'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyA+PgplbmRvYmoKdHJhaWxlcgo8PCAvUm9vdCAxIDAgUiA+PgolJUVPRgo=',
        'requested',
        'approved',
        'to_be_paid',
        null,
        now() - interval '20 days',
        now() - interval '3 days',
        'not_synced',
        null,
        null,
        null,
        0,
        null,
        null
    ),
    (
        '40000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000009',
        75.00,
        current_date - 40,
        'Finance workshop catering',
        'Legal & Finance',
        'reimbursement',
        'DE12500105170648489890',
        'INGDDEFFXXX',
        'finance-catering.pdf',
        'application/pdf',
        'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyA+PgplbmRvYmoKdHJhaWxlcgo8PCAvUm9vdCAxIDAgUiA+PgolJUVPRgo=',
        'paid',
        'approved',
        'paid',
        null,
        now() - interval '38 days',
        now() - interval '10 days',
        'synced',
        'MM-LOCAL-0003',
        'finance-catering.pdf',
        now() - interval '10 days',
        1,
        now() - interval '10 days',
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        '40000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000005',
        19.99,
        current_date - 8,
        'Community stickers without budget approval',
        'Community',
        'reimbursement',
        'DE89370400440532013000',
        'COBADEFFXXX',
        'stickers.pdf',
        'application/pdf',
        'JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyA+PgplbmRvYmoKdHJhaWxlcgo8PCAvUm9vdCAxIDAgUiA+PgolJUVPRgo=',
        'rejected',
        'not_approved',
        'to_be_paid',
        'Budget owner did not approve this expense.',
        now() - interval '8 days',
        now() - interval '1 day',
        'not_synced',
        null,
        null,
        null,
        0,
        null,
        null
    )
on conflict (id) do update set
    user_id = excluded.user_id,
    amount = excluded.amount,
    date = excluded.date,
    description = excluded.description,
    department = excluded.department,
    submission_type = excluded.submission_type,
    payment_iban = excluded.payment_iban,
    payment_bic = excluded.payment_bic,
    receipt_filename = excluded.receipt_filename,
    receipt_mime_type = excluded.receipt_mime_type,
    receipt_base64 = excluded.receipt_base64,
    status = excluded.status,
    approval_status = excluded.approval_status,
    payment_status = excluded.payment_status,
    rejection_reason = excluded.rejection_reason,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    bb_sync_status = excluded.bb_sync_status,
    bb_receipt_id_by_customer = excluded.bb_receipt_id_by_customer,
    bb_receipt_filename = excluded.bb_receipt_filename,
    bb_synced_at = excluded.bb_synced_at,
    bb_sync_attempts = excluded.bb_sync_attempts,
    bb_last_sync_attempt_at = excluded.bb_last_sync_attempt_at,
    bb_synced_by = excluded.bb_synced_by;
