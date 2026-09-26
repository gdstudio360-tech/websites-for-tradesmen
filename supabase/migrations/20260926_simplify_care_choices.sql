-- GD TradeWeb V12.1: simplify care choices and rename Automation Care to Pro Care

alter table public.leads
  drop constraint if exists leads_care_plan_check;

update public.leads
set care_plan = 'Pro Care — £99/month'
where care_plan = 'Automation Care — £99/month';

alter table public.leads
  add constraint leads_care_plan_check check (care_plan in (
    'No care plan',
    'Website Care — £29/month',
    'Business Care — £59/month',
    'Pro Care — £99/month'
  ));
