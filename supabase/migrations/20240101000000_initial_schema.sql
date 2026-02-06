-- Initial schema migration for member-manager

-- Members table
-- Stores member profile information linked to Supabase Auth users
create table if not exists public.members (
    user_id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    given_name text not null default '',
    surname text not null default '',
    salutation text not null default '',
    title text not null default '',
    date_of_birth date not null default '1900-01-01',
    street text not null default '',
    number text not null default '',
    postal_code text not null default '',
    city text not null default '',
    country text not null default '',
    active boolean not null default true,
    created_at timestamptz not null default now()
);

-- SEPA table
-- Stores banking information for SEPA direct debit
create table if not exists public.sepa (
    user_id uuid primary key references public.members(user_id) on delete cascade,
    iban text not null,
    bic text,
    bank_name text not null,
    mandate_agreed boolean not null default false,
    privacy_agreed boolean not null default false,
    created_at timestamptz not null default now()
);

-- User roles table
-- Stores user role assignments (user, admin, etc.)
create table if not exists public.user_roles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null default 'user',
    created_at timestamptz not null default now()
);

-- Enable Row Level Security on all tables
alter table public.members enable row level security;
alter table public.sepa enable row level security;
alter table public.user_roles enable row level security;

-- RLS Policies for members table

-- Users can view their own member record
create policy "Users can view own member record"
    on public.members for select
    using (auth.uid() = user_id);

-- Admins can view all member records
create policy "Admins can view all member records"
    on public.members for select
    using (
        exists (
            select 1 from public.user_roles
            where user_roles.user_id = auth.uid()
            and user_roles.role = 'admin'
        )
    );

-- Users can insert their own member record
create policy "Users can insert own member record"
    on public.members for insert
    with check (auth.uid() = user_id);

-- Users can update their own member record
create policy "Users can update own member record"
    on public.members for update
    using (auth.uid() = user_id);

-- Admins can update all member records
create policy "Admins can update all member records"
    on public.members for update
    using (
        exists (
            select 1 from public.user_roles
            where user_roles.user_id = auth.uid()
            and user_roles.role = 'admin'
        )
    );

-- RLS Policies for sepa table

-- Users can view their own SEPA record
create policy "Users can view own SEPA record"
    on public.sepa for select
    using (auth.uid() = user_id);

-- Admins can view all SEPA records
create policy "Admins can view all SEPA records"
    on public.sepa for select
    using (
        exists (
            select 1 from public.user_roles
            where user_roles.user_id = auth.uid()
            and user_roles.role = 'admin'
        )
    );

-- Users can insert their own SEPA record
create policy "Users can insert own SEPA record"
    on public.sepa for insert
    with check (auth.uid() = user_id);

-- Users can update their own SEPA record
create policy "Users can update own SEPA record"
    on public.sepa for update
    using (auth.uid() = user_id);

-- Admins can update all SEPA records
create policy "Admins can update all SEPA records"
    on public.sepa for update
    using (
        exists (
            select 1 from public.user_roles
            where user_roles.user_id = auth.uid()
            and user_roles.role = 'admin'
        )
    );

-- RLS Policies for user_roles table

-- Users can view their own role
create policy "Users can view own role"
    on public.user_roles for select
    using (auth.uid() = user_id);

-- Admins can view all roles
create policy "Admins can view all roles"
    on public.user_roles for select
    using (
        exists (
            select 1 from public.user_roles ur
            where ur.user_id = auth.uid()
            and ur.role = 'admin'
        )
    );

-- Allow insert of user role (for new user registration)
create policy "Users can insert own role"
    on public.user_roles for insert
    with check (auth.uid() = user_id);

-- Admins can update roles
create policy "Admins can update roles"
    on public.user_roles for update
    using (
        exists (
            select 1 from public.user_roles ur
            where ur.user_id = auth.uid()
            and ur.role = 'admin'
        )
    );

-- Create indexes for common queries
create index if not exists idx_members_email on public.members(email);
create index if not exists idx_members_active on public.members(active);
create index if not exists idx_members_created_at on public.members(created_at);
create index if not exists idx_user_roles_role on public.user_roles(role);
