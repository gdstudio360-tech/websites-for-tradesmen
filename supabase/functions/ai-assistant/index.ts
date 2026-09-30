import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://gdstudio360.co.uk",
  "https://www.gdstudio360.co.uk",
  "https://gdstudio360-tech.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

const MAX_MESSAGE_LENGTH = 1500;
const HISTORY_LIMIT = 14;

const SYSTEM_PROMPT = `
You are the customer-facing AI assistant for GD Studio 360.

GD Studio 360 currently builds professional websites for UK tradespeople.

Your job:
- answer questions about GD Studio 360;
- understand what website the customer needs;
- help the customer choose between Starter, Business and Pro;
- ask short useful follow-up questions when necessary;
- explain Website Care;
- encourage a suitable customer to submit an enquiry;
- escalate to a human when something is outside the known offer.

CURRENT WEBSITE PACKAGES

STARTER — £249
For a sole trader who needs a clean professional online presence.
Includes:
- 1-page website
- up to 6 core sections
- mobile responsive design
- services section
- WhatsApp and enquiry buttons
- contact / quote section
- basic local SEO setup
- 1 revision round

BUSINESS — £399
For an established trade business that wants to look credible and convert enquiries.
Includes everything in Starter plus:
- up to 5 pages
- project gallery
- reviews section
- service-area content
- FAQ section
- custom branding and colours
- domain setup support
- 2 revision rounds

PRO — £599
For businesses that need more pages, stronger structure and room to grow.
Includes everything in Business plus:
- up to 8 pages
- individual service pages
- stronger local SEO structure
- advanced enquiry flow
- 3 revision rounds
- priority build queue

WEBSITE CARE
Care is optional and currently available for websites built by GD Studio 360.

Starter Care — £29/month:
- routine health checks
- backups
- up to 30 minutes of small text/image updates per month

Business Care — £59/month:
- form and email checks
- troubleshooting
- up to 60 minutes of content updates per month

Pro Care — £99/month:
- support for the existing backend
- automated emails
- webhooks
- payment integrations
- up to 90 minutes of maintenance per month

IMPORTANT RULES
- These are introductory launch prices.
- Never invent prices, discounts, services or package features.
- Never promise e-commerce, marketing, advertising or other services unless they are explicitly added to the GD Studio 360 offer later.
- Never guarantee enquiries, rankings, sales or business results.
- Domain registration, paid third-party services and work outside the agreed package may cost extra.
- Website Care is optional.
- Do not negotiate prices.
- Do not promise a completion date unless a human has confirmed it.
- Do not make legal commitments.
- Do not process refunds.
- Do not ask for card or banking details.
- Payments are handled through the secure SumUp payment flow after project approval.
- If the customer asks for something outside the known offer, say that a human needs to review it.
- If the customer asks to speak to a person, do not resist; offer human follow-up.
- Keep answers concise, friendly and professional.
- Ask at most one or two questions at a time.
- Reply in the customer's language when clear; otherwise use natural UK English.
- Never claim to be a human. If relevant, identify yourself as the GD Studio 360 AI Assistant.
`;

function getCorsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin":
      ALLOWED_ORIGINS.has(origin) ? origin : "https://gdstudio360.co.uk",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string,
) {
  return Response.json(body, {
    status,
    headers: getCorsHeaders(origin),
  });
}

function extractOpenAIText(payload: any): string {
  if (
    typeof payload?.output_text === "string" &&
    payload.output_text.trim()
  ) {
    return payload.output_text.trim();
  }

  for (const item of payload?.output || []) {
    for (const part of item?.content || []) {
      if (
        part?.type === "output_text" &&
        typeof part?.text === "string" &&
        part.text.trim()
      ) {
        return part.text.trim();
      }
    }
  }

  return "";
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";

  if (req.method === "OPTIONS") {
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return new Response("Forbidden", { status: 403 });
    }

    return new Response("ok", {
      headers: getCorsHeaders(origin),
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      { ok: false, error: "Method not allowed." },
      405,
      origin,
    );
  }

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse(
      { ok: false, error: "Origin not allowed." },
      403,
      origin,
    );
  }

  try {
    const body = await req.json();

    const message = String(body?.message || "").trim();
    const requestedConversationId =
      String(body?.conversation_id || "").trim() || null;

    if (!message) {
      return jsonResponse(
        { ok: false, error: "Message is required." },
        400,
        origin,
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse(
        {
          ok: false,
          error: `Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters.`,
        },
        400,
        origin,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SECRET_KEY");

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const openaiModel =
      Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna";

    if (!serviceKey) {
      throw new Error("Supabase service key is not configured.");
    }

    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const db = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: tenant, error: tenantError } = await db
      .from("tenants")
      .select("id")
      .eq("slug", "gd-studio-360")
      .single();

    if (tenantError || !tenant) {
      throw new Error("GD Studio 360 tenant was not found.");
    }

    let conversationId = requestedConversationId;

    if (conversationId) {
      const { data: existing, error: existingError } = await db
        .from("conversations")
        .select("id, tenant_id, channel, status, ai_enabled")
        .eq("id", conversationId)
        .eq("tenant_id", tenant.id)
        .eq("channel", "website")
        .maybeSingle();

      if (existingError || !existing) {
        return jsonResponse(
          { ok: false, error: "Conversation not found." },
          404,
          origin,
        );
      }

      if (existing.status === "closed") {
        return jsonResponse(
          { ok: false, error: "This conversation is closed." },
          409,
          origin,
        );
      }

      if (!existing.ai_enabled) {
        return jsonResponse(
          {
            ok: false,
            human_required: true,
            error: "AI replies are disabled for this conversation.",
          },
          409,
          origin,
        );
      }
    } else {
      const { data: created, error: createError } = await db
        .from("conversations")
        .insert({
          tenant_id: tenant.id,
          channel: "website",
          status: "open",
          ai_enabled: true,
          human_attention_required: false,
        })
        .select("id")
        .single();

      if (createError || !created) {
        throw createError || new Error("Could not create conversation.");
      }

      conversationId = created.id;
    }

    const { error: customerMessageError } = await db
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "customer",
        channel: "website",
        content: message,
      });

    if (customerMessageError) {
      throw customerMessageError;
    }

    const { data: recentMessages, error: historyError } = await db
      .from("messages")
      .select("role, content, created_at")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    if (historyError) {
      throw historyError;
    }

    const history = [...(recentMessages || [])].reverse();

    const transcript = history
      .map((item) => {
        const speaker =
          item.role === "customer"
            ? "Customer"
            : item.role === "assistant"
            ? "Assistant"
            : item.role === "human"
            ? "Human"
            : "System";

        return `${speaker}: ${item.content}`;
      })
      .join("\n\n");

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: openaiModel,
          instructions: SYSTEM_PROMPT,
          input: transcript,
          max_output_tokens: 450,
        }),
      },
    );

    const openaiPayload = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error(
        "OPENAI_RESPONSE_ERROR",
        openaiResponse.status,
        JSON.stringify(openaiPayload),
      );

      throw new Error(
        openaiPayload?.error?.message ||
        "AI service could not generate a response.",
      );
    }

    const reply = extractOpenAIText(openaiPayload);

    if (!reply) {
      throw new Error("AI service returned an empty response.");
    }

    const { error: assistantMessageError } = await db
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "assistant",
        channel: "website",
        content: reply,
      });

    if (assistantMessageError) {
      throw assistantMessageError;
    }

    await db
      .from("conversations")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    await db
      .from("audit_log")
      .insert({
        tenant_id: tenant.id,
        actor_type: "assistant",
        action: "assistant_reply_created",
        entity_type: "conversation",
        entity_id: conversationId,
        details: {
          channel: "website",
          model: openaiModel,
        },
      });

    return jsonResponse(
      {
        ok: true,
        conversation_id: conversationId,
        reply,
      },
      200,
      origin,
    );
  } catch (error) {
    console.error("AI_ASSISTANT_ERROR", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown assistant error.",
      },
      500,
      origin,
    );
  }
});
