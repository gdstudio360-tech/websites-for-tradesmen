import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://gdstudio360.co.uk",
  "https://www.gdstudio360.co.uk",
  "https://gdstudio360-tech.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin":
      ALLOWED_ORIGINS.has(origin)
        ? origin
        : "https://gdstudio360.co.uk",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: cors(origin),
    });
  }

  if (req.method !== "POST") {
    return Response.json(
      { ok: false, error: "Method not allowed." },
      { status: 405, headers: cors(origin) },
    );
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return Response.json(
      { ok: false, error: "Origin not allowed." },
      { status: 403, headers: cors(origin) },
    );
  }

  try {
    const body = await req.json();

    const conversationId =
      String(body?.conversation_id || "").trim();

    const acceptedTerms =
      body?.accepted_terms === true;

    const humanContact =
      body?.human_contact &&
      typeof body.human_contact === "object"
        ? body.human_contact
        : null;

    if (!conversationId) {
      throw new Error("Missing conversation_id.");
    }

    if (!acceptedTerms) {
      throw new Error(
        "The Enquiry Terms and Privacy Notice must be accepted."
      );
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL")!;

    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SECRET_KEY");

    if (!serviceKey) {
      throw new Error(
        "Supabase service key is not configured."
      );
    }

    const db = createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: { persistSession: false },
      },
    );

    const { data: tenant, error: tenantError } =
      await db
        .from("tenants")
        .select("id")
        .eq("slug", "gd-studio-360")
        .single();

    if (tenantError || !tenant) {
      throw new Error(
        "GD Studio 360 tenant was not found."
      );
    }

    const { data: existingLead } =
      await db
        .from("leads")
        .select("id, contact_id")
        .eq("conversation_id", conversationId)
        .maybeSingle();

    if (existingLead) {
      return Response.json(
        {
          ok: true,
          already_submitted: true,
          lead_id: existingLead.id,
          reply:
            "Your enquiry has already been submitted. GD Studio 360 will review it and get back to you.",
        },
        { headers: cors(origin) },
      );
    }

    const {
      data: conversation,
      error: conversationError,
    } = await db
      .from("conversations")
      .select(
        "id, tenant_id, channel, pending_enquiry"
      )
      .eq("id", conversationId)
      .eq("tenant_id", tenant.id)
      .eq("channel", "website")
      .single();

    if (conversationError || !conversation) {
      throw new Error("Conversation not found.");
    }

    let e = conversation.pending_enquiry;

    if (humanContact) {
      const name =
        String(humanContact.name || "").trim();

      const email =
        String(humanContact.email || "").trim().toLowerCase();

      const phone =
        String(humanContact.phone || "").trim();

      const business =
        String(humanContact.business || "").trim();

      const message =
        String(humanContact.message || "").trim();

      if (!name) {
        throw new Error("Please enter your name.");
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Please enter a valid email address.");
      }

      e = {
        name,
        business: business || "Not provided",
        trade: "Not specified",
        area: "Not specified",
        email,
        phone: phone || null,
        current_site: null,
        package: "Not sure — human consultation",
        care_plan: "No care plan",
        project_summary:
          message ||
          "Customer requested a human consultation before choosing a website package.",
      };
    }

    if (!e) {
      throw new Error(
        "There is no prepared enquiry to submit."
      );
    }

    const { data: lead, error: leadError } =
      await db
        .from("leads")
        .insert({
          tenant_id: tenant.id,
          conversation_id: conversationId,
          name: e.name,
          business: e.business,
          trade: e.trade,
          area: e.area,
          email: e.email,
          phone: e.phone || null,
          current_site: e.current_site || null,
          package: e.package,
          care_plan:
            e.care_plan || "No care plan",
          message: e.project_summary,
          terms_accepted: true,
          source: "website",
          status: "new",
        })
        .select("id, contact_id")
        .single();

    if (leadError || !lead) {
      throw leadError ||
        new Error("Could not create enquiry.");
    }

    const now = new Date().toISOString();

    const { error: conversationUpdateError } =
      await db
        .from("conversations")
        .update({
          contact_id: lead.contact_id,
          pending_enquiry: null,
          pending_enquiry_at: null,
          status: "waiting_human",
          human_attention_required: true,
          updated_at: now,
        })
        .eq("id", conversationId);

    if (conversationUpdateError) {
      throw conversationUpdateError;
    }

    await db
      .from("consent_events")
      .insert({
        tenant_id: tenant.id,
        contact_id: lead.contact_id,
        purpose:
          e.package === "Not sure — human consultation"
            ? "human_consultation_request"
            : "website_project_enquiry",
        consent_given: true,
        source: "website_ai_chat",
        privacy_policy_version: "2026-09",
      });

    await db
      .from("audit_log")
      .insert({
        tenant_id: tenant.id,
        actor_type: "system",
        action: "customer_submitted_ai_enquiry",
        entity_type: "conversation",
        entity_id: conversationId,
        details: {
          lead_id: lead.id,
          contact_id: lead.contact_id,
          source: "website_ai_chat",
        },
      });

    const isHumanHandoff =
      e.package === "Not sure — human consultation";

    const reply = isHumanHandoff
      ? "Thanks — your request has been sent to GD Studio 360. A person will review it and contact you using the details you provided. No payment has been taken."
      : "Thanks — your enquiry has been submitted to GD Studio 360. We’ll review your project and contact you using the details you provided. No payment has been taken.";

    await db
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        channel: "website",
        content: reply,
      });

    return Response.json(
      {
        ok: true,
        lead_id: lead.id,
        reply,
      },
      { headers: cors(origin) },
    );

  } catch (error) {
    console.error(
      "SUBMIT_CHAT_ENQUIRY_ERROR",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error.",
      },
      {
        status: 400,
        headers: cors(origin),
      },
    );
  }
});
