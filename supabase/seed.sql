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
        school,
        reimbursement_slack_notifications_enabled
    )
    select
        seed.id,
        seed.given_name,
        seed.surname,
        'Mx.',
        '',
        'enc-v1:PdayjKDOvLrZMvx8:xaHiqMnPTTIA_5_QoVTl5A:Rp2u_WN-8II1kg',
        'enc-v1:KayxX15tC5KsZjmV:XD6OlMbTzQ8jgNhi4b4s0g:4rtmTi7apV9d',
        'enc-v1:4nzjSgR9J9GRvgg_:29setZNZRF45zRpI6d7IAw:Ug',
        'enc-v1:yTsQTkeGtBWuP7K6:iFXk_mYsMGRIipjMEwYcRg:GtEZaOc',
        'enc-v1:EYlRk3adH607ILIa:xOZ7xlx4Pwb7Dhcrh9QeBA:sZa6AUZ3',
        'enc-v1:Y77LXHDOldiZ1ebq:FE_F7G5bHEGYGHy-pdDkrw:KExwzY-SXg',
        true,
        seed.batch,
        seed.department,
        seed.member_role,
        seed.board_role,
        seed.degree,
        seed.school,
        coalesce(seed.department = 'Legal & Finance', false) or
            seed.access_role = 'admin'
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
        school = excluded.school,
        reimbursement_slack_notifications_enabled = excluded.reimbursement_slack_notifications_enabled;

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
        ('00000000-0000-0000-0000-000000000001'::uuid, 'enc-v1:sgZXsPSycaTwe0Kq:GV_c8-J7Ksht5oQ16AWmpw:bFYrlagwDie3xlcS-bI', 'active', null, 'https://linkedin.com/in/ada-president', 'Munich, Germany'),
        ('00000000-0000-0000-0000-000000000003'::uuid, 'enc-v1:hKoXvXPwNDemTulk:K2tZWud-ne1NqNrIt3Vz2A:QOl2iwAO0GWDw6ZxqbY', 'active', null, 'https://linkedin.com/in/bianca-boardlead', 'Garching, Germany'),
        ('00000000-0000-0000-0000-000000000006'::uuid, null, 'active', null, null, null),
        ('00000000-0000-0000-0000-000000000009'::uuid, 'enc-v1:RWCXcjr53__9HfPa:p28knmcVA315wdEcsZdJWA:Zb33zVgWaLzAGAcflNA', 'active', null, 'https://linkedin.com/in/lea-finance', 'Munich, Germany'),
        ('00000000-0000-0000-0000-000000000011'::uuid, 'enc-v1:xdfzQFf58uesW3Rt:F32vcNWqooqYVPAIWepLQA:qKb10QfcDkye0VsHYW4', 'active', null, 'https://linkedin.com/in/maya-makeathon', 'Munich, Germany'),
        ('00000000-0000-0000-0000-000000000017'::uuid, 'enc-v1:jcmnq9qOSj22Qfwz:K4_39VPBtfCaR-Jlao7NQg:i0IvNLLurkCpUJyh8bw', 'active', 'applied-ai-research', 'https://linkedin.com/in/rita-research', 'Munich, Germany'),
        ('00000000-0000-0000-0000-000000000018'::uuid, 'enc-v1:WNTSAsGcm_G7l2tb:oFnWF4J20R_htkYu9ioVmg:PRfVcBDZRkTXiPSCtiI', 'alumni', 'robotics-lab', 'https://linkedin.com/in/robin-research', 'Berlin, Germany'),
        ('00000000-0000-0000-0000-000000000020'::uuid, 'enc-v1:Ttex0cwMpLSF1f8Y:JT_3yLRlQ2evpmjDMA3ulQ:W3aH9gEtzKtNmYwG0cs', 'active', null, 'https://linkedin.com/in/regular-user', 'Munich, Germany'),
        ('00000000-0000-0000-0000-000000000022'::uuid, null, 'inactive', null, null, 'Remote')
) as seed(user_id, phone, member_status, research_project_id, linkedin_profile_url, public_location)
where member.user_id = seed.user_id;

-- Seed SEPA data for local test accounts. Values use the local fixture
-- FIELD_ENCRYPTION_KEY from scripts/setup-local-env.mjs; never put plaintext
-- bank details in this file.
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
        'enc-v1:E2I_KLowkHdM-n9Z:OEnMYTwkgQRnVzzuwcI1lg:Za1nGGjQUJRYiTDQGEYT7ACrg-KSqA',
        'enc-v1:bY8E0a6BFgepkeqP:l64uBscW7LkzZviYiCk8Tg:GHMQbhYQHkcp8F4',
        'enc-v1:i2MaKOdWh5oC7v1o:QgupJ8CIB0xrY5x4PPn6XA:koPDlqjFnrgDTSU',
        true,
        true
    ),
    (
        '00000000-0000-0000-0000-000000000009',
        'enc-v1:Ekoon2EwfRQP7Hlx:B8o6WdarxLcizaNURTTvCg:RWIR7IC1UDedhMo1ymWA8zcp7J_baw',
        'enc-v1:NdN4FTJySiu1e8i2:0KlU0xtHk-tPQt9h6FD7IQ:u_vcnoNiNUm4RQg',
        'enc-v1:U80B8plAN0s70vns:SZrsaVu-hPtPzLKS_EbwqA:h7wKk93Gb8Y',
        true,
        true
    ),
    (
        '00000000-0000-0000-0000-000000000011',
        'enc-v1:E2I_KLowkHdM-n9Z:OEnMYTwkgQRnVzzuwcI1lg:Za1nGGjQUJRYiTDQGEYT7ACrg-KSqA',
        'enc-v1:bY8E0a6BFgepkeqP:l64uBscW7LkzZviYiCk8Tg:GHMQbhYQHkcp8F4',
        'enc-v1:i2MaKOdWh5oC7v1o:QgupJ8CIB0xrY5x4PPn6XA:koPDlqjFnrgDTSU',
        true,
        true
    ),
    (
        '00000000-0000-0000-0000-000000000020',
        'enc-v1:E2I_KLowkHdM-n9Z:OEnMYTwkgQRnVzzuwcI1lg:Za1nGGjQUJRYiTDQGEYT7ACrg-KSqA',
        'enc-v1:bY8E0a6BFgepkeqP:l64uBscW7LkzZviYiCk8Tg:GHMQbhYQHkcp8F4',
        'enc-v1:i2MaKOdWh5oC7v1o:QgupJ8CIB0xrY5x4PPn6XA:koPDlqjFnrgDTSU',
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
    ),
    (
        '20000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000011',
        'pending',
        '{"member_role": "Team Lead", "department": "Marketing"}'::jsonb,
        'Stepping up to lead the marketing team next semester.',
        null,
        null,
        null,
        now() - interval '6 hours'
    ),
    (
        '20000000-0000-0000-0000-000000000005',
        '00000000-0000-0000-0000-000000000005',
        'pending',
        '{"member_status": "alumni", "batch": "WS22"}'::jsonb,
        'Finished my studies this spring — please move me to alumni.',
        null,
        null,
        null,
        now() - interval '3 hours'
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
    ),
    (
        '30000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000011',
        'pending',
        '[{"id":"seed-engagement-4","startDate":"2024-10-01","endDate":"","isStillActive":true,"weeklyHours":"8","department":"Marketing","isTeamLead":true,"specialRole":"Team Lead","tasksDescription":"Led marketing campaigns and managed the content calendar across channels."}]'::jsonb,
        null,
        null,
        null,
        now() - interval '5 hours'
    ),
    (
        '30000000-0000-0000-0000-000000000005',
        '00000000-0000-0000-0000-000000000005',
        'pending',
        '[{"id":"seed-engagement-5a","startDate":"2023-04-01","endDate":"2024-03-31","isStillActive":false,"weeklyHours":"6","department":"Research","isTeamLead":false,"tasksDescription":"Contributed to the perception research project and co-authored a workshop paper."},{"id":"seed-engagement-5b","startDate":"2024-04-01","endDate":"","isStillActive":true,"weeklyHours":"10","department":"Software Development","isTeamLead":true,"specialRole":"Team Lead","tasksDescription":"Led the platform team and mentored new contributors."}]'::jsonb,
        null,
        null,
        null,
        now() - interval '2 hours'
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
        'enc-v1:E2I_KLowkHdM-n9Z:OEnMYTwkgQRnVzzuwcI1lg:Za1nGGjQUJRYiTDQGEYT7ACrg-KSqA',
        'enc-v1:bY8E0a6BFgepkeqP:l64uBscW7LkzZviYiCk8Tg:GHMQbhYQHkcp8F4',
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
        'enc-v1:E2I_KLowkHdM-n9Z:OEnMYTwkgQRnVzzuwcI1lg:Za1nGGjQUJRYiTDQGEYT7ACrg-KSqA',
        'enc-v1:bY8E0a6BFgepkeqP:l64uBscW7LkzZviYiCk8Tg:GHMQbhYQHkcp8F4',
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
        'enc-v1:Ekoon2EwfRQP7Hlx:B8o6WdarxLcizaNURTTvCg:RWIR7IC1UDedhMo1ymWA8zcp7J_baw',
        'enc-v1:NdN4FTJySiu1e8i2:0KlU0xtHk-tPQt9h6FD7IQ:u_vcnoNiNUm4RQg',
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
        'enc-v1:E2I_KLowkHdM-n9Z:OEnMYTwkgQRnVzzuwcI1lg:Za1nGGjQUJRYiTDQGEYT7ACrg-KSqA',
        'enc-v1:bY8E0a6BFgepkeqP:l64uBscW7LkzZviYiCk8Tg:GHMQbhYQHkcp8F4',
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

-- =========================================================================
-- Broaden SEPA + agreement coverage to every seeded member so reimbursement
-- and payment flows can be exercised from any local login (not just the four
-- accounts above). Existing rows are left untouched (`do nothing`).
-- =========================================================================
insert into public.sepa (user_id, iban, bic, bank_name, mandate_agreed, privacy_agreed)
select
    m.user_id,
    'enc-v1:E2I_KLowkHdM-n9Z:OEnMYTwkgQRnVzzuwcI1lg:Za1nGGjQUJRYiTDQGEYT7ACrg-KSqA',
    'enc-v1:bY8E0a6BFgepkeqP:l64uBscW7LkzZviYiCk8Tg:GHMQbhYQHkcp8F4',
    'enc-v1:i2MaKOdWh5oC7v1o:QgupJ8CIB0xrY5x4PPn6XA:koPDlqjFnrgDTSU',
    true,
    true
from public.members m
on conflict (user_id) do nothing;

insert into public.member_agreements (
    user_id, sepa_mandate_agreed, privacy_policy_agreed, data_privacy_notice_agreed
)
select m.user_id, true, true, true
from public.members m
on conflict (user_id) do nothing;

-- =========================================================================
-- Member CVs (metadata only). Storage objects cannot be created from SQL, so
-- the referenced PDF does not exist in the `member-cvs` bucket — the CV panel
-- renders the version/history UI, but the download/signed-URL action will 404.
-- This is intentional and sufficient for verifying the CV UI locally.
-- =========================================================================
insert into public.member_cvs (
    id, user_id, storage_bucket, storage_path, original_filename, mime_type,
    size_bytes, sha256, source, version, is_current, uploaded_at, uploaded_by_user_id
) values
    (
        '50000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'member-cvs',
        '00000000-0000-0000-0000-000000000001/seed-cv-v1.pdf',
        'ada-president-cv.pdf',
        'application/pdf',
        24576,
        '0000000000000000000000000000000000000000000000000000000000000001',
        'admin_upload',
        1,
        false,
        now() - interval '60 days',
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        '50000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'member-cvs',
        '00000000-0000-0000-0000-000000000001/seed-cv-v2.pdf',
        'ada-president-cv.pdf',
        'application/pdf',
        28672,
        '0000000000000000000000000000000000000000000000000000000000000002',
        'member_upload',
        2,
        true,
        now() - interval '10 days',
        '00000000-0000-0000-0000-000000000001'
    ),
    (
        '50000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000020',
        'member-cvs',
        '00000000-0000-0000-0000-000000000020/seed-cv-v1.pdf',
        'regular-user-cv.pdf',
        'application/pdf',
        20480,
        '0000000000000000000000000000000000000000000000000000000000000003',
        'application',
        1,
        true,
        now() - interval '5 days',
        '00000000-0000-0000-0000-000000000020'
    )
on conflict (id) do nothing;

-- =========================================================================
-- TUM.ai Days: one upcoming (not yet sent) and one past (already sent) event,
-- plus a spread of yes/no RSVPs so the manage view and response stats render.
-- =========================================================================
insert into public.tumai_days (id, agenda, scheduled_at, sent_at, created_at) values
    (
        '60000000-0000-0000-0000-000000000001',
        E'Upcoming TUM.ai Day\n- 18:00 Welcome & org updates\n- 18:30 Department breakouts\n- 19:30 Social & pizza',
        now() + interval '9 days',
        null,
        now() - interval '2 days'
    ),
    (
        '60000000-0000-0000-0000-000000000002',
        E'Past TUM.ai Day\n- Semester kickoff\n- Makeathon retro\n- New member onboarding',
        now() - interval '21 days',
        now() - interval '28 days',
        now() - interval '30 days'
    )
on conflict (id) do nothing;

insert into public.tumai_day_responses (id, tumai_day_id, user_id, status, reason) values
    ('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'yes', null),
    ('61000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'yes', null),
    ('61000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000006', 'no', 'Travelling that week.'),
    ('61000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'yes', null),
    ('61000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'yes', null),
    ('61000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000020', 'no', 'Exam period.')
on conflict (id) do nothing;

-- =========================================================================
-- Job posting requests covering all review states and job types. The table's
-- review_state_check requires: pending => no reviewer/published; approved =>
-- reviewed_by + reviewed_at + published_at all set; rejected => reviewed_by +
-- reviewed_at set, published_at null. Admin (user 1) is the reviewer.
-- =========================================================================
insert into public.job_posting_requests (
    id, user_id, status, title, organization_name, description_markdown,
    call_to_action, job_type, location, contact_name, contact_email, contact_role,
    external_url, expires_at, published_at, review_note, reviewed_by, reviewed_at, created_at
) values
    (
        '70000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000020',
        'pending',
        'Working Student – Machine Learning',
        'Acme AI GmbH',
        E'## About the role\nSupport our ML team with data pipelines and model evaluation.\n\n- 15–20h/week\n- Hybrid in Munich',
        'Apply now',
        'working_student',
        'Munich, Germany',
        'Hanna Recruiter',
        'jobs@acme-ai.example',
        'Talent Lead',
        'https://acme-ai.example/careers/ml-werkstudent',
        now() + interval '30 days',
        null,
        null,
        null,
        null,
        now() - interval '1 day'
    ),
    (
        '70000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000011',
        'approved',
        'AI Research Internship (6 months)',
        'DeepLab Research',
        E'## Internship\nWork on applied LLM research alongside our core team.\n\n- Full-time, 6 months\n- Stipend provided',
        'Apply now',
        'internship',
        'Berlin, Germany (hybrid)',
        'Jonas Lead',
        'careers@deeplab.example',
        'Research Manager',
        'https://deeplab.example/internships',
        now() + interval '45 days',
        now() - interval '4 days',
        'Approved — relevant to our research members.',
        '00000000-0000-0000-0000-000000000001',
        now() - interval '4 days',
        now() - interval '6 days'
    ),
    (
        '70000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000005',
        'approved',
        'Master Thesis – Robotics Perception',
        'TUM Robotics Lab',
        E'## Thesis opportunity\nDevelop perception models for autonomous manipulation.\n\n- 6 months\n- Co-supervised',
        'Get in touch',
        'thesis',
        'Garching, Germany',
        'Prof. Dr. Maier',
        'thesis@robotics.tum.example',
        'Supervisor',
        null,
        now() + interval '90 days',
        now() - interval '2 days',
        'Approved.',
        '00000000-0000-0000-0000-000000000001',
        now() - interval '2 days',
        now() - interval '3 days'
    ),
    (
        '70000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000006',
        'rejected',
        'Unpaid "growth hacker" gig',
        'Sketchy Startup',
        E'Vague description, no compensation details, off-topic for members.',
        'Apply now',
        'other',
        'Remote',
        'Anon Founder',
        'founder@sketchy.example',
        null,
        null,
        null,
        null,
        'Rejected — does not meet job board guidelines (no compensation, off-topic).',
        '00000000-0000-0000-0000-000000000001',
        now() - interval '1 day',
        now() - interval '2 days'
    ),
    (
        '70000000-0000-0000-0000-000000000005',
        '00000000-0000-0000-0000-000000000021',
        'approved',
        'Full-Time ML Engineer',
        'Venture Co',
        E'## Full-time role\nBuild and ship ML features end to end.\n\n- Competitive salary\n- Munich-based',
        'Apply now',
        'full_time',
        'Munich, Germany',
        'Valerie Venture',
        'hiring@venture.example',
        'CTO',
        'https://venture.example/jobs/ml-engineer',
        now() + interval '60 days',
        now() - interval '7 days',
        'Approved.',
        '00000000-0000-0000-0000-000000000001',
        now() - interval '7 days',
        now() - interval '9 days'
    ),
    (
        '70000000-0000-0000-0000-000000000006',
        '00000000-0000-0000-0000-000000000018',
        'pending',
        'Part-Time Frontend Developer',
        'Pixel Labs',
        E'## Frontend role\nBuild delightful UI with React and TypeScript.\n\n- 12h/week\n- Remote-friendly',
        'Apply now',
        'working_student',
        'Remote (EU)',
        'Mara Hiring',
        'jobs@pixellabs.example',
        'Engineering Lead',
        'https://pixellabs.example/careers/frontend',
        now() + interval '40 days',
        null,
        null,
        null,
        null,
        now() - interval '8 hours'
    ),
    (
        '70000000-0000-0000-0000-000000000007',
        '00000000-0000-0000-0000-000000000003',
        'pending',
        'Master Thesis – LLM Evaluation',
        'TUM Data Lab',
        E'## Thesis\nDesign evaluation harnesses for large language models.\n\n- 6 months\n- Co-supervised with industry',
        'Get in touch',
        'thesis',
        'Garching, Germany',
        'Dr. Schmidt',
        'thesis@datalab.tum.example',
        'Supervisor',
        null,
        now() + interval '120 days',
        null,
        null,
        null,
        null,
        now() - interval '5 hours'
    )
on conflict (id) do nothing;

-- =========================================================================
-- Contract submissions referencing the templates seeded by migrations
-- (template 001 = Long-Term Partnership, 002 = Hackathon, 003 = Jury). Covers
-- the submitted -> in_review -> approved -> sent_to_partner -> completed and
-- rejected states so the contract review queue and detail views render.
-- =========================================================================
insert into public.contract_submissions (
    id, template_id, submitter_user_id, form_data, generated_contract_text,
    status, notes, feedback_message, signature_token, signature_token_expires_at,
    signer_name, signed_at, reviewed_by, reviewed_at, sent_to_partner_at,
    completed_at, submitted_at, created_at, updated_at
) values
    (
        '80000000-0000-0000-0000-000000000001',
        '10000000-0000-4000-8000-000000000001',
        '00000000-0000-0000-0000-000000000015',
        jsonb_build_object(
            'partner_company_name', 'Globex SE',
            'partner_address', 'Hauptstr. 1, 80333 Munich',
            'partner_representative', 'Dr. Erika Mustermann',
            'partner_description', 'Industrial automation company.',
            'sponsoring_package', 'long_term_gold',
            'payment_due_date', '2026-08-01',
            'start_date', '2026-07-01',
            'end_date', '2027-06-30',
            'tumai_contact_name', 'Paula Partners',
            'tumai_contact_email', 'partners-sponsors-lead@example.com',
            'partner_contact_name', 'Erika Mustermann',
            'partner_contact_email', 'erika@globex.example',
            'tumai_signer_name', 'Ada President'
        ),
        'Generated contract text for Globex SE (Long-Term Partnership, Gold).',
        'submitted', null, null, null, null, null, null, null, null, null, null,
        now() - interval '3 days', now() - interval '3 days', now() - interval '3 days'
    ),
    (
        '80000000-0000-0000-0000-000000000002',
        '10000000-0000-4000-8000-000000000002',
        '00000000-0000-0000-0000-000000000016',
        jsonb_build_object(
            'partner_company_name', 'Initech GmbH',
            'partner_address', 'Lindwurmstr. 5, 80337 Munich',
            'partner_representative', 'Peter Initech',
            'event_name', 'TUM.ai Makeathon 2026',
            'event_start_date', '2026-09-12',
            'event_end_date', '2026-09-14',
            'event_location', 'Munich',
            'sponsoring_package', 'ehl_silver',
            'tumai_signer_name', 'Ada President',
            'partner_contact_email', 'peter@initech.example'
        ),
        'Generated contract text for Initech GmbH (Hackathon, Silver).',
        'in_review', 'Checking liability clause.', null, null, null, null, null,
        null, null, null, null,
        now() - interval '6 days', now() - interval '6 days', now() - interval '5 days'
    ),
    (
        '80000000-0000-0000-0000-000000000003',
        '10000000-0000-4000-8000-000000000001',
        '00000000-0000-0000-0000-000000000015',
        jsonb_build_object(
            'partner_company_name', 'Umbrella AG',
            'partner_address', 'Schellingstr. 4, 80799 Munich',
            'partner_representative', 'Alice Umbrella',
            'partner_description', 'Biotech research firm.',
            'sponsoring_package', 'long_term_silver',
            'payment_due_date', '2026-07-15',
            'start_date', '2026-07-01',
            'end_date', '2027-06-30',
            'tumai_contact_name', 'Paula Partners',
            'tumai_contact_email', 'partners-sponsors-lead@example.com',
            'partner_contact_name', 'Alice Umbrella',
            'partner_contact_email', 'alice@umbrella.example',
            'tumai_signer_name', 'Ada President'
        ),
        'Generated contract text for Umbrella AG (Long-Term Partnership, Silver).',
        'approved', 'Looks good, ready to send.', null, null, null, null, null,
        '00000000-0000-0000-0000-000000000001', now() - interval '2 days', null, null,
        now() - interval '8 days', now() - interval '8 days', now() - interval '2 days'
    ),
    (
        '80000000-0000-0000-0000-000000000004',
        '10000000-0000-4000-8000-000000000001',
        '00000000-0000-0000-0000-000000000015',
        jsonb_build_object(
            'partner_company_name', 'Soylent Corp',
            'partner_address', 'Marienplatz 8, 80331 Munich',
            'partner_representative', 'Bob Soylent',
            'partner_description', 'Food technology company.',
            'sponsoring_package', 'long_term_bronze',
            'payment_due_date', '2026-09-01',
            'start_date', '2026-08-01',
            'end_date', '2027-07-31',
            'tumai_contact_name', 'Paula Partners',
            'tumai_contact_email', 'partners-sponsors-lead@example.com',
            'partner_contact_name', 'Bob Soylent',
            'partner_contact_email', 'bob@soylent.example',
            'tumai_signer_name', 'Ada President'
        ),
        'Generated contract text for Soylent Corp (Long-Term Partnership, Bronze).',
        'sent_to_partner', null, null,
        'seed-signature-token-soylent-0004', now() + interval '14 days',
        null, null,
        '00000000-0000-0000-0000-000000000001', now() - interval '4 days',
        now() - interval '3 days', null,
        now() - interval '10 days', now() - interval '10 days', now() - interval '3 days'
    ),
    (
        '80000000-0000-0000-0000-000000000005',
        '10000000-0000-4000-8000-000000000003',
        '00000000-0000-0000-0000-000000000016',
        jsonb_build_object(
            'partner_company_name', 'Hooli LLC',
            'partner_address', 'Sendlinger Str. 10, 80331 Munich',
            'partner_representative', 'Gavin Hooli',
            'event_start_date', '2026-06-01',
            'event_end_date', '2026-06-02',
            'event_location', 'Munich',
            'sponsoring_package', 'e_lab_final',
            'tumai_signer_name', 'Ada President',
            'partner_contact_email', 'gavin@hooli.example'
        ),
        'Generated contract text for Hooli LLC (Jury seat, Final).',
        'completed', null, null, null, null,
        'Gavin Hooli', now() - interval '1 day',
        '00000000-0000-0000-0000-000000000001', now() - interval '6 days',
        now() - interval '5 days', now() - interval '1 day',
        now() - interval '12 days', now() - interval '12 days', now() - interval '1 day'
    ),
    (
        '80000000-0000-0000-0000-000000000006',
        '10000000-0000-4000-8000-000000000002',
        '00000000-0000-0000-0000-000000000016',
        jsonb_build_object(
            'partner_company_name', 'Vandelay Industries',
            'partner_address', 'Unknown',
            'partner_representative', 'Art Vandelay',
            'event_name', 'TUM.ai Makeathon 2026',
            'event_start_date', '2026-09-12',
            'event_end_date', '2026-09-14',
            'event_location', 'Munich',
            'sponsoring_package', 'ehl_bronze',
            'tumai_signer_name', 'Ada President',
            'partner_contact_email', 'art@vandelay.example'
        ),
        'Generated contract text for Vandelay Industries (Hackathon, Bronze).',
        'rejected', null, 'Partner could not confirm budget; resubmit next quarter.',
        null, null, null, null,
        '00000000-0000-0000-0000-000000000001', now() - interval '1 day', null, null,
        now() - interval '5 days', now() - interval '5 days', now() - interval '1 day'
    )
on conflict (id) do nothing;

-- Status history for seeded contract submissions. The migration backfills rows
-- before this seed data is inserted during a fresh local reset, so seed needs
-- explicit history rows to keep the contract timeline populated locally.
insert into public.contract_status_events (
    id, submission_id, from_status, to_status, changed_by_name, note, created_at
) values
    (
        '82000000-0000-0000-0000-000000000001',
        '80000000-0000-0000-0000-000000000001',
        null,
        'submitted',
        'Seed data',
        'Seeded current status',
        now() - interval '3 days'
    ),
    (
        '82000000-0000-0000-0000-000000000002',
        '80000000-0000-0000-0000-000000000002',
        null,
        'in_review',
        'Seed data',
        'Seeded current status',
        now() - interval '5 days'
    ),
    (
        '82000000-0000-0000-0000-000000000003',
        '80000000-0000-0000-0000-000000000003',
        null,
        'approved',
        'Seed data',
        'Seeded current status',
        now() - interval '2 days'
    ),
    (
        '82000000-0000-0000-0000-000000000004',
        '80000000-0000-0000-0000-000000000004',
        null,
        'sent_to_partner',
        'Seed data',
        'Seeded current status',
        now() - interval '3 days'
    ),
    (
        '82000000-0000-0000-0000-000000000005',
        '80000000-0000-0000-0000-000000000005',
        null,
        'completed',
        'Seed data',
        'Seeded current status',
        now() - interval '1 day'
    ),
    (
        '82000000-0000-0000-0000-000000000006',
        '80000000-0000-0000-0000-000000000006',
        null,
        'rejected',
        'Seed data',
        'Partner could not confirm budget; resubmit next quarter.',
        now() - interval '1 day'
    )
on conflict (id) do nothing;

-- A couple of document versions for the sent-to-partner submission, and the
-- partner's comment, so the contract detail/version history renders.
insert into public.contract_document_versions (
    id, submission_id, version_number, source, rendered_text, rendered_html,
    form_data_snapshot, created_by, created_at
) values
    (
        '81000000-0000-0000-0000-000000000001',
        '80000000-0000-0000-0000-000000000004',
        1,
        'generated',
        'Generated contract text for Soylent Corp (Long-Term Partnership, Bronze).',
        '<p>Generated contract text for Soylent Corp (Long-Term Partnership, Bronze).</p>',
        '{}'::jsonb,
        '00000000-0000-0000-0000-000000000001',
        now() - interval '4 days'
    ),
    (
        '81000000-0000-0000-0000-000000000002',
        '80000000-0000-0000-0000-000000000004',
        2,
        'sent_to_partner',
        'Revised contract text sent to Soylent Corp for signature.',
        '<p>Revised contract text sent to Soylent Corp for signature.</p>',
        '{}'::jsonb,
        '00000000-0000-0000-0000-000000000001',
        now() - interval '3 days'
    )
on conflict (id) do nothing;

insert into public.contract_partner_comments (
    id, submission_id, author_type, author_name, author_email, comment,
    document_version_id, created_at
) values
    (
        '82000000-0000-0000-0000-000000000001',
        '80000000-0000-0000-0000-000000000004',
        'partner',
        'Bob Soylent',
        'bob@soylent.example',
        'Could we adjust the payment due date to September 15th?',
        '81000000-0000-0000-0000-000000000002',
        now() - interval '2 days'
    )
on conflict (id) do nothing;

-- =========================================================================
-- Round 2 Nr.5a: render real contract text for the seeded submissions above.
-- The rows are inserted with a short placeholder, then this block substitutes
-- the actual template text (mirroring the server's renderContractText: enrich
-- the package fields, replace {{variable}} tokens, blank unknown tokens) so
-- local previews/PDFs show realistic contracts instead of a one-line stub.
-- It also creates the initial document version each submission would have
-- gotten when created through the UI.
-- =========================================================================
do $seed_contract_render$
declare
    sub record;
    entry record;
    pkg record;
    enriched jsonb;
    rendered text;
begin
    for sub in
        select s.id, s.form_data, t.contract_text
        from public.contract_submissions s
        join public.contract_templates t on t.id = s.template_id
        where s.generated_contract_text like 'Generated contract text for %'
    loop
        enriched := sub.form_data;

        -- Package enrichment (subset of shared/src/contracts.ts used by seeds).
        select * into pkg from (values
            ('long_term_bronze', 'Long-Term Partnership - Bronze', '6.000 EUR / Jahr', 'sechstausend',
                E'- Partner logo on website\n- 2x LinkedIn post per year\n- 1x Networking event invitation', '6.000 EUR'),
            ('long_term_silver', 'Long-Term Partnership - Silver', '12.000 EUR / Jahr', 'zwoelftausend',
                E'- Partner logo on website\n- 2x LinkedIn post per year\n- 1x Networking event invitation\n- Access to CV database (CVs der zwei letzten Batches, ca. 100-150 CVs)\n- 1x Co-organized event\n- 2x Job postings to community', '12.000 EUR'),
            ('long_term_gold', 'Long-Term Partnership - Gold', '15.000 EUR / Jahr', 'fuenfzehntausend',
                E'- Distinguished logo placement\n- 2x LinkedIn post per year\n- 1x Networking event invitation\n- Access to CV database (CVs der zwei letzten Batches, ca. 100-150 CVs)\n- 2x Co-organized events\n- Unlimited Job postings\n- First-choice for Hackathons', '15.000 EUR'),
            ('ehl_bronze', 'EHL Hackathon Pass - Bronze', '4.500 EUR', 'viertausendfuenfhundert',
                E'- 1x Booth at the venue\n- 1x Networking event invitation\n- 2x Announced on LinkedIn', '4.500 EUR'),
            ('ehl_silver', 'EHL Hackathon Pass - Silver', '7.500 EUR', 'siebentausendfuenfhundert',
                E'- 1x Custom Challenge path\n- 2x Announced on LinkedIn\n- 1x Participant list (incl. CVs)', '7.500 EUR'),
            ('e_lab_final', 'E-Lab Jury Seat Final Pitch', '3.500 EUR', 'dreitausendfuenfhundert',
                E'- 1x Jury Seat beim Final Pitch', '3.500 EUR')
        ) as p(key, label, amount_label, amount_words, benefits, total_label)
        where p.key = enriched->>'sponsoring_package';

        if found then
            enriched := enriched || jsonb_build_object(
                'package_label', pkg.label,
                'package_amount_label', pkg.amount_label,
                'package_amount_words', pkg.amount_words,
                'package_benefits', pkg.benefits,
                'total_amount_label', pkg.total_label,
                'addon_terms', 'Keine Add-ons ausgewaehlt.',
                'package_footnote', 'Subject to topic being related to Club and approved by both parties. Pricing may vary depending on individual scope and agreement.'
            );
        end if;

        rendered := sub.contract_text;
        for entry in select key, value from jsonb_each_text(enriched) loop
            rendered := replace(rendered, '{{' || entry.key || '}}', coalesce(entry.value, ''));
        end loop;
        -- Unresolved tokens render as empty strings, like the server renderer.
        rendered := regexp_replace(rendered, '\{\{[a-zA-Z0-9_]+\}\}', '', 'g');

        update public.contract_submissions
        set generated_contract_text = rendered,
            form_data = enriched
        where id = sub.id;

        -- Fix the placeholder in the pre-seeded Soylent v1 document version.
        update public.contract_document_versions
        set rendered_text = rendered,
            rendered_html = '<section><p>' ||
                replace(replace(replace(rendered, '&', '&amp;'), '<', '&lt;'), E'\n', '<br>') ||
                '</p></section>',
            form_data_snapshot = enriched
        where submission_id = sub.id
          and version_number = 1
          and rendered_text like 'Generated contract text for %';

        -- Initial document version, as the UI creation flow would have made.
        if not exists (
            select 1 from public.contract_document_versions v
            where v.submission_id = sub.id
        ) then
            insert into public.contract_document_versions (
                id, submission_id, version_number, source, rendered_text,
                rendered_html, form_data_snapshot, created_by, created_at
            ) values (
                gen_random_uuid(), sub.id, 1, 'generated', rendered,
                '<section><p>' ||
                    replace(replace(replace(rendered, '&', '&amp;'), '<', '&lt;'), E'\n', '<br>') ||
                    '</p></section>',
                enriched, '00000000-0000-0000-0000-000000000001', now() - interval '3 days'
            );
        end if;

        update public.contract_submissions s2
        set active_document_version_id = (
            select v.id from public.contract_document_versions v
            where v.submission_id = sub.id
            order by v.version_number desc
            limit 1
        )
        where s2.id = sub.id
          and s2.active_document_version_id is null;
    end loop;
end $seed_contract_render$;
