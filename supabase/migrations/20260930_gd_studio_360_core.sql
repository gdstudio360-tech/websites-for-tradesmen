-- GD Studio 360 Core CRM / AI Assistant database foundation
-- Existing leads/payment workflow is intentionally left intact.

create extension if not exists pgcrypto;

-- =========================================================
-- TENANTS / CLIENT BUSINESSES
-- =========================================================

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active'
    check (status in ('active', 'paused', 'closed')),
  created_at timestamptz not null default now()
);

insert into public.tenants (name, slug)
values ('GD Studio 360', 'gd-studio-360')
on conflict (slug) do nothing;

-- =========================================================
-- TENANT MEMBERS
-- =========================================================

create table if not exists public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin'
    check (role in ('owner', 'admin', 'staff', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);


-- Give existing GD Studio 360 admins access to the main tenant.
insert into public.tenant_members (tenant_id, user_id, role)
select t.id, a.user_id, 'owner'
from public.tenants t
cross join public.admin_users a
where t.slug = 'gd-studio-360'
on conflict (tenant_id, user_id)
do update set role = excluded.role;

-- =========================================================
-- DOMAINS
-- =========================================================

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  domain text not null unique,
  is_primary boolean not null default false,
  status text not null default 'active'
    check (status in ('active', 'pending', 'disabled')),
  created_at timestamptz not null default now()
);

insert into public.domains (tenant_id, domain, is_primary)
select id, 'gdstudio360.co.uk', true
from public.tenants
where slug = 'gd-studio-360'
on conflict (domain) do nothing;

-- =========================================================
-- CONTACTS
-- =========================================================

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  name text,
  business_name text,
  email text,
  phone text,

  source text
    check (source in ('website', 'email', 'whatsapp', 'phone', 'manual', 'other')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists contacts_tenant_idx
  on public.contacts(tenant_id);

create index if not exists contacts_email_idx
  on public.contacts(lower(email));

create index if not exists contacts_phone_idx
  on public.contacts(phone);

-- =========================================================
-- CONVERSATIONS
-- =========================================================

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,

  channel text not null
    check (channel in ('website', 'email', 'whatsapp', 'voice', 'manual')),

  external_thread_id text,

  status text not null default 'open'
    check (status in ('open', 'waiting_human', 'closed')),

  ai_enabled boolean not null default true,
  human_attention_required boolean not null default false,

  summary text,

  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,

  retention_until timestamptz
);

create index if not exists conversations_tenant_idx
  on public.conversations(tenant_id);

create index if not exists conversations_contact_idx
  on public.conversations(contact_id);

-- =========================================================
-- MESSAGES
-- =========================================================

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null
    references public.conversations(id) on delete cascade,

  role text not null
    check (role in ('customer', 'assistant', 'human', 'system')),

  channel text not null
    check (channel in ('website', 'email', 'whatsapp', 'voice', 'manual')),

  content text not null,

  external_message_id text,

  created_at timestamptz not null default now(),
  retention_until timestamptz,
  deleted_at timestamptz
);

create index if not exists messages_conversation_idx
  on public.messages(conversation_id, created_at);

-- =========================================================
-- AI RECOMMENDATIONS
-- =========================================================

create table if not exists public.ai_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,

  recommendation_type text not null,
  recommended_value text,
  reason text,
  confidence text
    check (confidence in ('low', 'medium', 'high')),

  created_at timestamptz not null default now()
);

-- =========================================================
-- PRIVACY / DATA SUBJECT REQUESTS
-- =========================================================

create table if not exists public.privacy_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,

  request_type text not null
    check (request_type in ('access', 'deletion', 'correction', 'restriction', 'objection', 'export')),

  status text not null default 'received'
    check (status in ('received', 'in_progress', 'completed', 'rejected')),

  requested_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz,
  notes text
);

-- =========================================================
-- CONSENT EVENTS
-- =========================================================

create table if not exists public.consent_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,

  purpose text not null,
  consent_given boolean not null,

  source text,
  privacy_policy_version text,

  created_at timestamptz not null default now()
);

-- =========================================================
-- AUDIT LOG
-- =========================================================

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,

  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null default 'system'
    check (actor_type in ('user', 'assistant', 'system', 'webhook')),

  action text not null,
  entity_type text,
  entity_id uuid,

  details jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists audit_log_tenant_idx
  on public.audit_log(tenant_id, created_at desc);

-- =========================================================
-- RLS
-- New CRM tables are NOT available directly to anonymous visitors.
-- Website/email/WhatsApp AI will access them through Edge Functions.
-- =========================================================

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.domains enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.ai_recommendations enable row level security;
alter table public.privacy_requests enable row level security;
alter table public.consent_events enable row level security;
alter table public.audit_log enable row level security;

-- Members may read their own tenant membership.
drop policy if exists "members read own memberships"
on public.tenant_members;

create policy "members read own memberships"
on public.tenant_members
for select
to authenticated
using (user_id = auth.uid());

-- Tenant members may read contacts belonging to their tenant.
drop policy if exists "tenant members read contacts"
on public.contacts;

create policy "tenant members read contacts"
on public.contacts
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = contacts.tenant_id
      and tm.user_id = auth.uid()
  )
);

-- Tenant members may read conversations belonging to their tenant.
drop policy if exists "tenant members read conversations"
on public.conversations;

create policy "tenant members read conversations"
on public.conversations
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = conversations.tenant_id
      and tm.user_id = auth.uid()
  )
);

-- Messages inherit access through their conversation.
drop policy if exists "tenant members read messages"
on public.messages;

create policy "tenant members read messages"
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    join public.tenant_members tm
      on tm.tenant_id = c.tenant_id
    where c.id = messages.conversation_id
      and tm.user_id = auth.uid()
  )
);

