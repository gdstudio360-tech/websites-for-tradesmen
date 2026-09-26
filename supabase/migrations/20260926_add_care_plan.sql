-- GD TradeWeb V12: optional website care plan
alter table public.leads
  add column if not exists care_plan text not null default 'No care plan';

alter table public.leads
  drop constraint if exists leads_care_plan_check;

alter table public.leads
  add constraint leads_care_plan_check check (care_plan in (
    'No care plan',
    'Website Care — £29/month',
    'Business Care — £59/month',
    'Automation Care — £99/month'
  ));
