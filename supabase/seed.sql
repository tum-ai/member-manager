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
) values
(
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'admin@example.com',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    ''
),
(
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'user@example.com',
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    'authenticated',
    'authenticated',
    '',
    '',
    '',
    ''
)
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
) values
(
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001',
    'email',
    '00000000-0000-0000-0000-000000000001',
    jsonb_build_object(
        'sub', '00000000-0000-0000-0000-000000000001',
        'email', 'admin@example.com',
        'email_verified', true,
        'provider', 'email'
    ),
    now(),
    now(),
    now()
),
(
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000002',
    'email',
    '00000000-0000-0000-0000-000000000002',
    jsonb_build_object(
        'sub', '00000000-0000-0000-0000-000000000002',
        'email', 'user@example.com',
        'email_verified', true,
        'provider', 'email'
    ),
    now(),
    now(),
    now()
)
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
) values
(
    '00000000-0000-0000-0000-000000000001',
    'Admin',
    'User',
    'Mr',
    'Dr.',
    '1990-01-15',
    'Admin Street',
    '1',
    '12345',
    'Munich',
    'Germany',
    true,
    null,
    null,
    null,
    null,
    null
),
(
    '00000000-0000-0000-0000-000000000002',
    'Regular',
    'User',
    'Ms',
    '',
    '1995-06-20',
    'User Lane',
    '42',
    '54321',
    'Berlin',
    'Germany',
    true,
    'WS23/24',
    'Tech',
    'Software Engineer',
    'B.Sc.',
    'TUM'
)
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
insert into public.user_roles (user_id, role) values
    ('00000000-0000-0000-0000-000000000001', 'admin'),
    ('00000000-0000-0000-0000-000000000002', 'user')
on conflict (user_id) do update set
    role = excluded.role;

-- Seed SEPA data for the regular user
insert into public.sepa (
    user_id,
    iban,
    bic,
    bank_name,
    mandate_agreed,
    privacy_agreed
) values (
    '00000000-0000-0000-0000-000000000002',
    'DE89370400440532013000',
    'COBADEFFXXX',
    'Commerzbank',
    true,
    true
) on conflict (user_id) do nothing;
