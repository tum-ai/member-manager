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
        batch text not null,
        department text not null,
        member_role text not null,
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
        degree,
        school,
        access_role
    ) values
        ('00000000-0000-0000-0000-000000000001', 'admin@example.com', 'Ada', 'President', 'WS22', 'Board', 'President', 'PhD', 'TUM', 'admin'),
        ('00000000-0000-0000-0000-000000000002', 'vice-president@example.com', 'Vera', 'Vice', 'SS23', 'Board', 'Vice-President', 'M.Sc. Management & Technology', 'TUM', 'admin'),
        ('00000000-0000-0000-0000-000000000003', 'board-lead@example.com', 'Bianca', 'Boardlead', 'WS23', 'Board', 'Team Lead', 'M.Sc. Management & Technology', 'LMU', 'user'),
        ('00000000-0000-0000-0000-000000000004', 'board-member@example.com', 'Ben', 'Boardmember', 'SS24', 'Board', 'Member', 'B.Sc. Computer Science', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000005', 'community-lead@example.com', 'Clara', 'Community', 'WS23', 'Community', 'Team Lead', 'M.Sc. Management & Technology', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000006', 'community-member@example.com', 'Chris', 'Community', 'SS24', 'Community', 'Member', 'B.Sc. Computer Science', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000007', 'innovation-lead@example.com', 'Ines', 'Innovation', 'WS23', 'Innovation Department', 'Team Lead', 'M.Sc. Management & Technology', 'LMU', 'user'),
        ('00000000-0000-0000-0000-000000000008', 'innovation-member@example.com', 'Ian', 'Innovation', 'SS24', 'Innovation Department', 'Member', 'B.Sc. Management & Technology', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000009', 'legal-finance-lead@example.com', 'Lea', 'Finance', 'WS23', 'Legal & Finance', 'Team Lead', 'M.Sc. Management & Technology', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000010', 'legal-finance-member@example.com', 'Luca', 'Finance', 'SS24', 'Legal & Finance', 'Member', 'B.Sc. Management & Technology', 'LMU', 'user'),
        ('00000000-0000-0000-0000-000000000011', 'makeathon-lead@example.com', 'Maya', 'Makeathon', 'WS23', 'Makeathon', 'Team Lead', 'M.Sc. Computer Science', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000012', 'makeathon-member@example.com', 'Max', 'Makeathon', 'SS24', 'Makeathon', 'Member', 'B.Sc. Computer Science', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000013', 'marketing-lead@example.com', 'Mina', 'Marketing', 'WS23', 'Marketing', 'Team Lead', 'M.Sc. Management & Technology', 'LMU', 'user'),
        ('00000000-0000-0000-0000-000000000014', 'marketing-member@example.com', 'Milo', 'Marketing', 'SS24', 'Marketing', 'Member', 'B.Sc. Management & Technology', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000015', 'partners-sponsors-lead@example.com', 'Paula', 'Partners', 'WS23', 'Partners & Sponsors', 'Team Lead', 'M.Sc. Management & Technology', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000016', 'partners-sponsors-member@example.com', 'Peter', 'Partners', 'SS24', 'Partners & Sponsors', 'Member', 'B.Sc. Management & Technology', 'LMU', 'user'),
        ('00000000-0000-0000-0000-000000000017', 'research-lead@example.com', 'Rita', 'Research', 'WS23', 'Research', 'Team Lead', 'PhD', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000018', 'research-member@example.com', 'Robin', 'Research', 'SS24', 'Research', 'Member', 'M.Sc. Computer Science', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000019', 'software-development-lead@example.com', 'Sofia', 'Software', 'WS23', 'Software Development', 'Team Lead', 'M.Sc. Computer Science', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000020', 'user@example.com', 'Regular', 'User', 'SS24', 'Software Development', 'Member', 'B.Sc. Computer Science', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000021', 'venture-lead@example.com', 'Valerie', 'Venture', 'WS23', 'Venture', 'Team Lead', 'M.Sc. Management & Technology', 'TUM', 'user'),
        ('00000000-0000-0000-0000-000000000022', 'venture-member@example.com', 'Victor', 'Venture', 'SS24', 'Venture', 'Member', 'B.Sc. Management & Technology', 'LMU', 'user');

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
        degree = excluded.degree,
        school = excluded.school;

-- Seed user roles
    insert into public.user_roles (user_id, role)
    select seed.id, seed.access_role
    from seed_users_local seed
    on conflict (user_id) do update set
        role = excluded.role;
end $$;

-- Seed SEPA data for a representative regular member
insert into public.sepa (
    user_id,
    iban,
    bic,
    bank_name,
    mandate_agreed,
    privacy_agreed
) values (
    '00000000-0000-0000-0000-000000000020',
    'DE89370400440532013000',
    'COBADEFFXXX',
    'Commerzbank',
    true,
    true
) on conflict (user_id) do nothing;
