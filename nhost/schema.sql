-- Full schema for attester.no on Nhost (Postgres + Hasura).
-- Idempotent: safe to re-run.

create table if not exists organizations (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null,
    created_at timestamptz not null default now()
);

alter table organizations add column if not exists generic_text text;
alter table organizations add column if not exists groups jsonb default '{}'::jsonb;
alter table organizations add column if not exists signatures jsonb default '[]'::jsonb;

create table if not exists certificates (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    volunteer_id text not null,
    hash text not null,
    created_at timestamptz not null default now()
);
create index if not exists certificates_lookup_idx on certificates (organization_id, volunteer_id);

create table if not exists user_organizations (
    user_id uuid not null references auth.users(id) on delete cascade,
    organization_id uuid not null references organizations(id) on delete cascade,
    role text not null default 'admin',
    primary key (user_id, organization_id)
);

create table if not exists volunteers (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    person_name text not null,
    group_name text not null,
    start_date text not null,
    end_date text not null,
    role text not null,
    extra_roles jsonb default '[]'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists templates (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    name text not null,
    description text,
    base_pdf text not null,
    schemas jsonb not null default '[]'::jsonb,
    is_default boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into organizations (slug, name) values ('echo', 'echo') on conflict (slug) do nothing;
insert into organizations (slug, name) values ('test', 'Test Organisation') on conflict (slug) do nothing;
