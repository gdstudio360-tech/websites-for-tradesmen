-- GD TradeWeb lead workflow schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  business text not null,
  trade text,
  area text,
  email text not null,
  phone text,
  current_site text,
  package text not null default 'Not sure — recommend one'
    check (package in (
      'Not sure — recommend one',
      'Starter — £249',
      'Business — £399',
      'Pro — £599'
    )),
  message text,
  terms_accepted boolean not null default false,

  status text not null default 'new'
    check (status in (
      'new',
      'approved',
      'deposit_sent',
      'deposit_paid',
      'building',
      'review',
      'balance_due',
      'completed',
      'rejected'
    )),

  deposit_amount integer,
  deposit_url text,
  payment_token uuid unique,
  sumup_checkout_id text,
  sumup_checkout_created_at timestamptz,
  deposit_paid_at timestamptz,
  approved_at timestamptz,
  approval_email_sent_at timestamptz,
  admin_notes text
);

alter table public.admin_users enable row level security;
alter table public.leads enable row level security;

drop policy if exists "admin can read own record" on public.admin_users;
create policy "admin can read own record"
on public.admin_users
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "public can submit safe leads" on public.leads;
create policy "public can submit safe leads"
on public.leads
for insert
to anon, authenticated
with check (
  status = 'new'
  and terms_accepted = true
  and deposit_amount is null
  and deposit_url is null
  and payment_token is null
  and sumup_checkout_id is null
  and sumup_checkout_created_at is null
  and deposit_paid_at is null
  and approved_at is null
  and approval_email_sent_at is null
);

drop policy if exists "admins can read leads" on public.leads;
create policy "admins can read leads"
on public.leads
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid()
  )
);

drop policy if exists "admins can update leads" on public.leads;
create policy "admins can update leads"
on public.leads
for update
to authenticated
using (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.admin_users a
    where a.user_id = auth.uid()
  )
);

create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists leads_status_idx on public.leads(status);

-- After you create your first Supabase Auth user, add its UUID here once:
-- insert into public.admin_users(user_id) values ('YOUR_AUTH_USER_UUID');
