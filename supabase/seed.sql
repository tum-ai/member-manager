-- Seed data for local development
-- This file runs after migrations when you run `supabase db reset`

-- Create test users in auth.users
-- Note: In local development, you can also create users via the Supabase Studio UI
-- or use the Auth API. These are seeded for convenience.

-- Insert a test admin user
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
    role
) values (
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
    'authenticated'
) on conflict (id) do nothing;

-- Insert a test regular user
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
    role
) values (
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
    'authenticated'
) on conflict (id) do nothing;

-- Seed member profiles
insert into public.members (
    user_id,
    email,
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
    school,
    skills,
    profile_picture_url
) values
(
    '00000000-0000-0000-0000-000000000001',
    'admin@example.com',
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
    null,
    null,
    null
),
(
    '00000000-0000-0000-0000-000000000002',
    'user@example.com',
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
    'TUM',
    ARRAY['TypeScript', 'React', 'Node.js']::text[],
    'https://example.com/profile.png'
)
on conflict (user_id) do update set
    email = excluded.email,
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
    school = excluded.school,
    skills = excluded.skills,
    profile_picture_url = excluded.profile_picture_url;

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
