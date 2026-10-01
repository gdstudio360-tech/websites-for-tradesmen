alter table public.leads
  add column if not exists attribution_source text;

alter table public.leads
  add column if not exists attribution_campaign text;
