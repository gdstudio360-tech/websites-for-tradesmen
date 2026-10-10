-- GD Studio 360: shared CRM address book and safe phone-based WhatsApp linking.
-- Run once in the Supabase SQL Editor for project wanakzqfhpkreurzjzbi.
-- Does NOT delete contacts, leads, conversations, or messages.
BEGIN;

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS marketing_opt_in_source text;

-- Compare +44 7700 900123, 07700 900123 and 00447700900123 as the same phone.
CREATE OR REPLACE FUNCTION public.gd360_phone_key(number_text text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN d ~ '^0044[0-9]{10}$' THEN substring(d FROM 3)
    WHEN d ~ '^44[0-9]{10}$' THEN d
    WHEN d ~ '^0[0-9]{10}$' THEN '44' || substring(d FROM 2)
    WHEN d ~ '^7[0-9]{9}$' THEN '44' || d
    WHEN d ~ '^00[1-9][0-9]{6,13}$' THEN substring(d FROM 3)
    ELSE d
  END
  FROM (SELECT regexp_replace(coalesce(number_text,''), '[^0-9]', '', 'g') AS d) x;
$$;

CREATE INDEX IF NOT EXISTS gd360_contacts_phone_key_idx
  ON public.contacts (tenant_id, public.gd360_phone_key(phone))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS gd360_leads_phone_key_idx
  ON public.leads (tenant_id, public.gd360_phone_key(phone));

-- Existing policy allows reading only. Permit writes for own tenant owners/admins.
-- No write privileges are given to anonymous website visitors.
GRANT SELECT, INSERT, UPDATE ON public.contacts TO authenticated;
DROP POLICY IF EXISTS "gd360 admins insert contacts" ON public.contacts;
CREATE POLICY "gd360 admins insert contacts"
ON public.contacts FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = contacts.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.role IN ('owner','admin'))
);

DROP POLICY IF EXISTS "gd360 admins update contacts" ON public.contacts;
CREATE POLICY "gd360 admins update contacts"
ON public.contacts FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = contacts.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.role IN ('owner','admin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.tenant_members tm
    WHERE tm.tenant_id = contacts.tenant_id
      AND tm.user_id = (SELECT auth.uid())
      AND tm.role IN ('owner','admin'))
);

-- Separate link table: never change the contact_id used by the live WhatsApp webhook.
-- A conversation keeps its WhatsApp contact, and may ALSO link to a CRM lead contact.
CREATE TABLE IF NOT EXISTS public.gd360_contact_links (
  conversation_id uuid PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  match_method text NOT NULL DEFAULT 'phone',
  linked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gd360_contact_links_target_idx
  ON public.gd360_contact_links(tenant_id,contact_id);
ALTER TABLE public.gd360_contact_links ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.gd360_contact_links TO authenticated;
REVOKE ALL ON public.gd360_contact_links FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.gd360_contact_links FROM authenticated;
DROP POLICY IF EXISTS "gd360 tenant members read contact links" ON public.gd360_contact_links;
CREATE POLICY "gd360 tenant members read contact links"
ON public.gd360_contact_links FOR SELECT TO authenticated
USING (EXISTS (
 SELECT 1 FROM public.tenant_members tm
 WHERE tm.tenant_id = gd360_contact_links.tenant_id AND tm.user_id = (SELECT auth.uid())
));

-- Only a UNIQUE lead->contact match for a phone can be linked.
-- Ambiguous numbers shared by multiple clients are left for manual review.
CREATE OR REPLACE FUNCTION public.gd360_link_wa_for_phone(p_tenant uuid, p_phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  phone_key text := public.gd360_phone_key(p_phone);
  candidate uuid;
  match_count integer;
BEGIN
  IF length(phone_key) < 7 THEN RETURN; END IF;

  SELECT count(DISTINCT l.contact_id), min(l.contact_id::text)::uuid
  INTO match_count, candidate
  FROM public.leads l
  WHERE l.tenant_id = p_tenant
    AND l.contact_id IS NOT NULL
    AND public.gd360_phone_key(l.phone) = phone_key;

  IF match_count <> 1 OR candidate IS NULL THEN RETURN; END IF;

  INSERT INTO public.gd360_contact_links(conversation_id,tenant_id,contact_id,match_method)
  SELECT w.id, p_tenant, candidate, 'phone'
  FROM public.conversations w
  JOIN public.contacts wc ON wc.id = w.contact_id AND wc.tenant_id = p_tenant
  WHERE w.tenant_id = p_tenant AND w.channel = 'whatsapp'
    AND public.gd360_phone_key(wc.phone) = phone_key
  ON CONFLICT (conversation_id) DO UPDATE
    SET contact_id = EXCLUDED.contact_id, linked_at = now();
END;
$$;

-- A website enquiry submitted AFTER a WhatsApp message links its earlier chat.
CREATE OR REPLACE FUNCTION public.gd360_lead_phone_link_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL AND NEW.phone IS NOT NULL THEN
    PERFORM public.gd360_link_wa_for_phone(NEW.tenant_id, NEW.phone);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_gd360_lead_phone_link ON public.leads;
CREATE TRIGGER trg_gd360_lead_phone_link
AFTER INSERT OR UPDATE OF phone, contact_id ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.gd360_lead_phone_link_trigger();

-- Incoming WhatsApp chats are cross-linked, without modifying webhook contact_id.
CREATE OR REPLACE FUNCTION public.gd360_wa_conversation_phone_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE customer_phone text;
BEGIN
  IF NEW.channel <> 'whatsapp' OR NEW.contact_id IS NULL THEN RETURN NEW; END IF;
  SELECT c.phone INTO customer_phone FROM public.contacts c
    WHERE c.id = NEW.contact_id AND c.tenant_id = NEW.tenant_id;
  IF customer_phone IS NOT NULL THEN
    PERFORM public.gd360_link_wa_for_phone(NEW.tenant_id, customer_phone);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_gd360_wa_conversation_phone_link ON public.conversations;
CREATE TRIGGER trg_gd360_wa_conversation_phone_link
AFTER INSERT OR UPDATE OF contact_id ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.gd360_wa_conversation_phone_link();

-- Backfill matches for existing website leads and WhatsApp chats.
DO $$
DECLARE r record;
BEGIN
 FOR r IN SELECT DISTINCT tenant_id, public.gd360_phone_key(phone) AS number_key
          FROM public.leads
          WHERE phone IS NOT NULL AND contact_id IS NOT NULL
 LOOP
   PERFORM public.gd360_link_wa_for_phone(r.tenant_id, r.number_key);
 END LOOP;
END;
$$;

-- Only the database triggers may modify automatic contact associations.
REVOKE ALL ON FUNCTION public.gd360_link_wa_for_phone(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gd360_lead_phone_link_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gd360_wa_conversation_phone_link() FROM PUBLIC, anon, authenticated;

COMMIT;
