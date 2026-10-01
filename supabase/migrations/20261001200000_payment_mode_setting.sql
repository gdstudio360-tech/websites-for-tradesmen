create table if not exists public.payment_settings (
  id smallint primary key check (id = 1),
  sumup_test_mode boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.payment_settings (
  id,
  sumup_test_mode
)
values (
  1,
  true
)
on conflict (id) do nothing;

alter table public.payment_settings
  enable row level security;

revoke all
on table public.payment_settings
from anon, authenticated;
