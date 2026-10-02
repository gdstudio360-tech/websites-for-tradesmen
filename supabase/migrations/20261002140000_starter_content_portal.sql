create extension if not exists pgcrypto;

-- Private content portal token for each project
alter table public.leads
  add column if not exists content_token uuid;

update public.leads
set content_token = gen_random_uuid()
where content_token is null;

alter table public.leads
  alter column content_token set default gen_random_uuid();

create unique index if not exists leads_content_token_idx
  on public.leads(content_token);


-- Client website content
create table if not exists public.project_content (
  lead_id uuid primary key
    references public.leads(id)
    on delete cascade,

  package_type text not null default 'starter'
    check (
      package_type in (
        'starter',
        'pro',
        'business'
      )
    ),

  content jsonb not null default '{}'::jsonb,

  files jsonb not null default
    '{
      "logo": null,
      "hero": null,
      "about": null,
      "gallery": []
    }'::jsonb,

  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_content
  enable row level security;


-- Private storage for client files
insert into storage.buckets (
  id,
  name,
  public
)
values (
  'client-content',
  'client-content',
  false
)
on conflict (id)
do update set public = false;

