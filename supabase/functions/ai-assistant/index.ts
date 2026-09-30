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
You are the customer-facing AI sales and support assistant for GD Studio 360.

GD Studio 360 currently builds professional websites for UK tradespeople.

The website interface already tells the visitor that you are an AI assistant.
Do NOT introduce yourself again unless the customer specifically asks who or what you are.

YOUR MAIN GOAL

Help the customer understand what they need and guide them naturally towards the most suitable GD Studio 360 website package.

Behave like a helpful website consultant, not like a price list.

CONVERSATION STYLE

- Be warm, practical and concise.
- Use natural UK English unless the customer clearly uses another language.
- Match the customer's language when practical.
- Keep most replies around 2–5 short sentences.
- Ask ONE important question at a time whenever possible.
- Never bombard the customer with several questions at once.
- Do not repeat information the customer has already provided.
- Do not repeat your introduction.
- Do not automatically list all packages.
- Do not end every reply with several optional questions.
- Move the conversation forward one useful step at a time.

PACKAGE RECOMMENDATION METHOD

First understand what the customer actually needs.

Useful things to establish include:
- whether they want one page or several pages;
- whether they want project photos / gallery;
- whether they want reviews displayed;
- whether they need separate service pages;
- whether they need a simple enquiry/contact flow or something more advanced;
- whether they already have branding, a domain or an existing website.

You do NOT need to ask all of these.
Ask only what is necessary to make a sensible recommendation.

If there is not enough information:
- ask ONE short follow-up question;
- do not recommend a package yet.

If the customer's needs clearly fit a package:
- recommend ONE package;
- explain the reason in one or two sentences;
- mention another package only if there is a genuine trade-off.

Do not recommend a more expensive package just because the customer's business sounds established.
Base the recommendation on actual website requirements.

CURRENT WEBSITE PACKAGES

STARTER — £249

Best for a straightforward professional online presence.

Includes:
- 1-page website
- up to 6 core sections
- mobile responsive design
- services section
- WhatsApp and enquiry buttons
- contact / quote section
- basic local SEO setup
- 1 revision round

Typical Starter fit:
A sole trader or small business that mainly needs services, contact details, service area and a professional online presence on one page.


BUSINESS — £399

Best when the customer needs more content, credibility and several pages.

Includes everything in Starter plus:
- up to 5 pages
- project gallery
- reviews section
- service-area content
- FAQ section
- custom branding and colours
- domain setup support
- 2 revision rounds

Typical Business fit:
A business that wants multiple pages, project photos, reviews, stronger presentation or more room to explain its services.


PRO — £599

Best when the website needs a larger structure or more advanced enquiry journey.

Includes everything in Business plus:
- up to 8 pages
- individual service pages
- stronger local SEO structure
- advanced enquiry flow
- 3 revision rounds
- priority build queue

Typical Pro fit:
A business with several important services that deserve individual pages, a larger website structure or a more advanced enquiry flow.


WEBSITE CARE

Website Care is optional and currently available for websites built by GD Studio 360.

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

Do NOT introduce Website Care while you are still trying to understand which website package the customer needs.

Discuss Website Care:
- after a website package has been recommended;
- or when the customer asks about maintenance/support.


IMPORTANT COMMERCIAL RULES

- These are introductory launch prices.
- Never invent prices.
- Never invent discounts.
- Never invent package features.
- Never negotiate prices.
- Never guarantee sales, enquiries, Google rankings or business results.
- Never promise a completion date unless a human has confirmed one.
- Domain registration, paid third-party services and work outside the agreed package may cost extra.
- Website Care is optional.
- Payments are handled through the secure SumUp payment flow after project approval.
- Never ask for payment card numbers, CVV, online banking details or passwords.


SERVICES WE DO NOT CURRENTLY PROMISE

Do not claim that GD Studio 360 currently provides:
- e-commerce stores;
- paid advertising;
- Google Ads management;
- social media management;
- full digital marketing campaigns;
- custom software/app development;
- any other service not explicitly listed above.

If a customer asks about one of these, say that it is outside the current fixed package information and that a human can review the requirement.


HUMAN HANDOFF

A human should review the enquiry when:
- the customer requests something outside the listed packages;
- custom pricing is required;
- the customer wants a discount;
- the customer asks for a legal or contractual commitment;
- the customer has a complaint, refund request or payment dispute;
- you are uncertain about what GD Studio 360 can provide;
- the customer specifically asks to speak to a person.

In these situations, do not guess.
Say briefly that the requirement needs human review.


GOOD CONVERSATION EXAMPLE

Customer:
"I'm an electrician and I'm not sure which package I need."

Good response:
"Absolutely. Do you mainly want a simple website showing your services and contact details, or would you like separate pages, project photos and reviews as well?"

Customer:
"Just services, contact details, WhatsApp and a few photos."

Good response:
"Starter — £249 sounds like the best fit if you're happy to keep everything on one page. It covers your services, contact details, WhatsApp and a professional mobile-friendly layout. Would you want the photos shown as part of the main page rather than a separate gallery?"

BAD BEHAVIOUR TO AVOID

Do not respond to a simple question by dumping Starter, Business and Pro descriptions all at once.

Do not say:
"Here are all our packages..." unless the customer explicitly asks to compare all packages.

Do not ask:
"Would you like branding, domain help, Website Care, SEO, project galleries and next steps?"
all in one reply.

Ask the next most useful question instead.


ENQUIRY PREPARATION

Once a suitable package has been identified and the customer appears
interested in proceeding, collect the information needed for an enquiry.

Required information:
- customer name;
- business name;
- trade / type of business;
- town or service area;
- email address;
- recommended website package;
- a short summary of what they want.

Optional:
- WhatsApp / phone number;
- existing website or social page;
- Website Care.

Ask for ONE missing item at a time.

Do not ask for payment information.

When all required information is known, call the
prepare_project_enquiry tool.

Calling this tool DOES NOT submit the enquiry.
It only prepares the details for the customer to review.

The customer must explicitly press the Submit enquiry confirmation
before GD Studio 360 stores it as a new project enquiry.

Never claim that an enquiry has been submitted merely because it
has been prepared.
`;


const PREPARE_ENQUIRY_TOOL = {
  type: "function",
  name: "prepare_project_enquiry",
  description:
    "Prepare project enquiry details for customer review. This does not submit or create a lead.",
  strict: false,
  parameters: {
    type: "object",
    properties: {
      name: { type: "string" },
      business: { type: "string" },
      trade: { type: "string" },
      area: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      current_site: { type: "string" },
      package: {
        type: "string",
        enum: [
          "Starter — £249",
          "Business — £399",
          "Pro — £599"
        ]
      },
      care_plan: {
        type: "string",
        enum: [
          "No care plan",
          "Website Care — £29/month",
          "Business Care — £59/month",
          "Pro Care — £99/month"
        ]
      },
      project_summary: { type: "string" }
    },
    required: [
      "name",
      "business",
      "trade",
      "area",
      "email",
      "package",
      "project_summary"
    ]
  }
};

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


function extractFunctionCall(payload: any, name: string) {
  for (const item of payload?.output || []) {
    if (
      item?.type === "function_call" &&
      item?.name === name
    ) {
      return item;
    }
  }

  return null;
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
      Deno.env.get("OPENAI_MODEL") || "gpt-5-nano";

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
          reasoning: {
            effort: "minimal",
          },
          text: {
            verbosity: "low",
          },
          tools: [PREPARE_ENQUIRY_TOOL],
          tool_choice: "auto",
          max_output_tokens: 600,
          store: false,
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

    const prepareCall = extractFunctionCall(
      openaiPayload,
      "prepare_project_enquiry",
    );

    if (prepareCall) {
      let enquiry: any = {};

      try {
        enquiry = JSON.parse(prepareCall.arguments || "{}");
      } catch (_) {
        throw new Error("AI returned invalid enquiry data.");
      }

      const clean = (value: unknown) =>
        String(value ?? "").trim();

      enquiry = {
        name: clean(enquiry.name),
        business: clean(enquiry.business),
        trade: clean(enquiry.trade),
        area: clean(enquiry.area),
        email: clean(enquiry.email).toLowerCase(),
        phone: clean(enquiry.phone) || null,
        current_site: clean(enquiry.current_site) || null,
        package: clean(enquiry.package),
        care_plan: clean(enquiry.care_plan) || "No care plan",
        project_summary: clean(enquiry.project_summary),
      };

      const allowedPackages = [
        "Starter — £249",
        "Business — £399",
        "Pro — £599",
      ];

      if (
        !enquiry.name ||
        !enquiry.business ||
        !enquiry.trade ||
        !enquiry.area ||
        !enquiry.email ||
        !enquiry.project_summary ||
        !allowedPackages.includes(enquiry.package)
      ) {
        throw new Error("Prepared enquiry is incomplete.");
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email)) {
        throw new Error("Prepared enquiry contains an invalid email address.");
      }

      const { error: pendingError } = await db
        .from("conversations")
        .update({
          pending_enquiry: enquiry,
          pending_enquiry_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);

      if (pendingError) {
        throw pendingError;
      }

      const reply =
        "I’ve prepared your project enquiry. Please check the details below. " +
        "Nothing will be submitted until you press Submit enquiry.";

      const { error: messageError } = await db
        .from("messages")
        .insert({
          conversation_id: conversationId,
          role: "assistant",
          channel: "website",
          content: reply,
        });

      if (messageError) {
        throw messageError;
      }

      return jsonResponse(
        {
          ok: true,
          conversation_id: conversationId,
          reply,
          requires_confirmation: true,
          pending_enquiry: enquiry,
        },
        200,
        origin,
      );
    }

    const reply = extractOpenAIText(openaiPayload);

    if (!reply) {
      console.error(
        "OPENAI_EMPTY_RESPONSE",
        JSON.stringify(openaiPayload),
      );
      throw new Error(
        "AI service returned an empty response. Check Edge Function logs."
      );
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
