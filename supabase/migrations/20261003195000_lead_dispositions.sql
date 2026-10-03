-- =========================================================
-- GD STUDIO 360
-- Lead rejection / resubmission / blocking workflow
-- =========================================================


-- ---------------------------------------------------------
-- LEADS
-- ---------------------------------------------------------

alter table public.leads
  add column if not exists rejection_kind text;

alter table public.leads
  add column if not exists rejection_note text;

alter table public.leads
  add column if not exists rejected_at timestamptz;

alter table public.leads
  add column if not exists is_resubmission boolean
  not null default false;

alter table public.leads
  add column if not exists previous_declined boolean
  not null default false;


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_rejection_kind_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_rejection_kind_check
      check (
        rejection_kind is null
        or rejection_kind in (
          'resubmit_requested',
          'declined',
          'blocked'
        )
      );
  end if;
end
$$;


-- Old rejected rows, if any, are treated as ordinary declines.
update public.leads
set
  rejection_kind = 'declined',
  rejected_at = coalesce(
    rejected_at,
    created_at,
    now()
  )
where status = 'rejected'
  and rejection_kind is null;


create index if not exists
  leads_rejection_kind_idx
on public.leads(rejection_kind)
where status = 'rejected';


-- ---------------------------------------------------------
-- CONTACTS
-- ---------------------------------------------------------

alter table public.contacts
  add column if not exists blocked boolean
  not null default false;

alter table public.contacts
  add column if not exists blocked_at timestamptz;

alter table public.contacts
  add column if not exists blocked_reason text;

alter table public.contacts
  add column if not exists blocked_by_lead_id uuid
  references public.leads(id)
  on delete set null;


create index if not exists
  contacts_blocked_idx
on public.contacts(blocked)
where blocked = true;
