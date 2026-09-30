-- GD Studio 360 Core
-- Link existing and future website leads to tenant/contact records
-- without changing the existing SumUp/payment workflow.

-- =========================================================
-- EXTEND LEADS
-- =========================================================

alter table public.leads
  add column if not exists tenant_id uuid
  references public.tenants(id) on delete restrict;

alter table public.leads
  add column if not exists contact_id uuid
  references public.contacts(id) on delete set null;

alter table public.leads
  add column if not exists source text not null default 'website';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_source_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_source_check
      check (
        source in (
          'website',
          'email',
          'whatsapp',
          'voice',
          'manual',
          'other'
        )
      );
  end if;
end
$$;

-- =========================================================
-- ASSIGN EXISTING LEADS TO GD STUDIO 360
-- =========================================================

update public.leads l
set tenant_id = t.id
from public.tenants t
where t.slug = 'gd-studio-360'
  and l.tenant_id is null;

-- One active contact per email inside each tenant.
create unique index if not exists contacts_tenant_email_unique_idx
on public.contacts (tenant_id, lower(email))
where email is not null
  and deleted_at is null;

-- =========================================================
-- CREATE CONTACTS FROM EXISTING LEADS
-- =========================================================

insert into public.contacts (
  tenant_id,
  name,
  business_name,
  email,
  phone,
  source,
  created_at,
  updated_at
)
select
  x.tenant_id,
  x.name,
  x.business,
  x.email,
  x.phone,
  'website',
  x.created_at,
  now()
from (
  select distinct on (l.tenant_id, lower(l.email))
    l.tenant_id,
    l.name,
    l.business,
    l.email,
    l.phone,
    l.created_at
  from public.leads l
  where l.tenant_id is not null
    and l.email is not null
  order by
    l.tenant_id,
    lower(l.email),
    l.created_at desc
) x
where not exists (
  select 1
  from public.contacts c
  where c.tenant_id = x.tenant_id
    and lower(c.email) = lower(x.email)
    and c.deleted_at is null
);

-- Attach existing leads to their contact.
update public.leads l
set contact_id = c.id
from public.contacts c
where l.contact_id is null
  and c.tenant_id = l.tenant_id
  and l.email is not null
  and c.email is not null
  and lower(c.email) = lower(l.email)
  and c.deleted_at is null;

-- =========================================================
-- AUTOMATIC SYNC FOR FUTURE WEBSITE LEADS
-- =========================================================

create or replace function public.sync_lead_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact_id uuid;
begin
  -- Current live site belongs to GD Studio 360.
  if new.tenant_id is null then
    select t.id
    into new.tenant_id
    from public.tenants t
    where t.slug = 'gd-studio-360'
    limit 1;
  end if;

  if new.tenant_id is null then
    raise exception 'GD Studio 360 tenant is not configured';
  end if;

  if new.email is not null and btrim(new.email) <> '' then

    select c.id
    into v_contact_id
    from public.contacts c
    where c.tenant_id = new.tenant_id
      and lower(c.email) = lower(btrim(new.email))
      and c.deleted_at is null
    limit 1;

    if v_contact_id is null then

      insert into public.contacts (
        tenant_id,
        name,
        business_name,
        email,
        phone,
        source,
        created_at,
        updated_at
      )
      values (
        new.tenant_id,
        nullif(btrim(new.name), ''),
        nullif(btrim(new.business), ''),
        btrim(new.email),
        nullif(btrim(new.phone), ''),
        coalesce(new.source, 'website'),
        now(),
        now()
      )
      returning id into v_contact_id;

    else

      update public.contacts
      set
        name = coalesce(
          nullif(btrim(new.name), ''),
          name
        ),
        business_name = coalesce(
          nullif(btrim(new.business), ''),
          business_name
        ),
        phone = coalesce(
          nullif(btrim(new.phone), ''),
          phone
        ),
        updated_at = now()
      where id = v_contact_id;

    end if;

    new.contact_id = v_contact_id;
  end if;

  return new;
end;
$$;

revoke all
on function public.sync_lead_contact()
from public;

drop trigger if exists trg_sync_lead_contact
on public.leads;

create trigger trg_sync_lead_contact
before insert or update of
  name,
  business,
  email,
  phone,
  tenant_id
on public.leads
for each row
execute function public.sync_lead_contact();

-- Existing rows are now assigned and future inserts are assigned by trigger.
alter table public.leads
  alter column tenant_id set not null;

create index if not exists leads_tenant_idx
  on public.leads(tenant_id);

create index if not exists leads_contact_idx
  on public.leads(contact_id);

