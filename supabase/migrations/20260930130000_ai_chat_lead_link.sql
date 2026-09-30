alter table public.leads
  add column if not exists conversation_id uuid
  references public.conversations(id) on delete set null;

create unique index if not exists leads_conversation_unique_idx
  on public.leads(conversation_id)
  where conversation_id is not null;

alter table public.conversations
  add column if not exists pending_enquiry jsonb;

alter table public.conversations
  add column if not exists pending_enquiry_at timestamptz;
