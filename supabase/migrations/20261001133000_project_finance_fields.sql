-- GD Studio 360 CRM project / final payment fields

alter table public.leads
  add column if not exists project_total integer;

alter table public.leads
  add column if not exists price_adjustment_note text;

alter table public.leads
  add column if not exists preview_url text;

alter table public.leads
  add column if not exists live_url text;

alter table public.leads
  add column if not exists balance_amount integer;

alter table public.leads
  add column if not exists balance_url text;

alter table public.leads
  add column if not exists balance_payment_token uuid;

alter table public.leads
  add column if not exists balance_sumup_checkout_id text;

alter table public.leads
  add column if not exists balance_sumup_checkout_created_at timestamptz;

alter table public.leads
  add column if not exists balance_sent_at timestamptz;

alter table public.leads
  add column if not exists balance_paid_at timestamptz;

alter table public.leads
  add column if not exists final_payment_email_sent_at timestamptz;


-- Give existing projects their normal package total.
update public.leads
set project_total =
  case package
    when 'Starter — £249' then 24900
    when 'Business — £399' then 39900
    when 'Pro — £599' then 59900
    else null
  end
where project_total is null;


create unique index if not exists
  leads_balance_payment_token_unique_idx
on public.leads(balance_payment_token)
where balance_payment_token is not null;


create index if not exists
  leads_balance_checkout_idx
on public.leads(balance_sumup_checkout_id)
where balance_sumup_checkout_id is not null;


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_project_total_positive'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_project_total_positive
      check (
        project_total is null
        or project_total >= 0
      );
  end if;
end
$$;


do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_balance_amount_positive'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_balance_amount_positive
      check (
        balance_amount is null
        or balance_amount >= 0
      );
  end if;
end
$$;
