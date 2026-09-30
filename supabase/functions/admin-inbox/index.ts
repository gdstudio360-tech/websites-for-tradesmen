import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("Missing authorization.");
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL")!;

    const publishableKey =
      Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SECRET_KEY");

    if (!serviceKey) {
      throw new Error(
        "Supabase service key is not configured."
      );
    }

    const userClient = createClient(
      supabaseUrl,
      publishableKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
        auth: {
          persistSession: false,
        },
      },
    );

    const serviceClient = createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          persistSession: false,
        },
      },
    );

    const {
      data: userData,
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !userData.user) {
      throw new Error("Invalid admin session.");
    }

    const { data: admin } =
      await serviceClient
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

    if (!admin) {
      return Response.json(
        {
          ok: false,
          error: "Not authorised as an admin.",
        },
        {
          status: 403,
          headers: corsHeaders,
        },
      );
    }

    const body = await req.json();

    const action =
      String(body?.action || "").trim();

    const leadId =
      String(body?.lead_id || "").trim();

    if (!leadId) {
      throw new Error("Missing lead_id.");
    }

    const {
      data: lead,
      error: leadError,
    } = await serviceClient
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found.");
    }

    if (action === "history") {
      if (!lead.conversation_id) {
        return Response.json(
          {
            ok: true,
            conversation_id: null,
            messages: [],
          },
          {
            headers: corsHeaders,
          },
        );
      }

      const {
        data: messages,
        error: messagesError,
      } = await serviceClient
        .from("messages")
        .select(
          "id, role, channel, content, created_at"
        )
        .eq(
          "conversation_id",
          lead.conversation_id
        )
        .is("deleted_at", null)
        .order(
          "created_at",
          { ascending: true }
        );

      if (messagesError) {
        throw messagesError;
      }

      return Response.json(
        {
          ok: true,
          conversation_id:
            lead.conversation_id,
          messages: messages || [],
        },
        {
          headers: corsHeaders,
        },
      );
    }

    if (action !== "send") {
      throw new Error("Unknown action.");
    }

    const message =
      String(body?.message || "").trim();

    if (!message) {
      throw new Error(
        "Write a reply before sending."
      );
    }

    if (message.length > 5000) {
      throw new Error(
        "Reply is too long."
      );
    }

    const email =
      String(lead.email || "").trim();

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error(
        "This customer does not have a valid email address."
      );
    }

    let conversationId =
      lead.conversation_id || null;

    if (!conversationId) {
      const {
        data: conversation,
        error: conversationError,
      } = await serviceClient
        .from("conversations")
        .insert({
          tenant_id: lead.tenant_id,
          contact_id: lead.contact_id || null,
          channel: "email",
          status: "open",
          ai_enabled: true,
          human_attention_required: false,
        })
        .select("id")
        .single();

      if (
        conversationError ||
        !conversation
      ) {
        throw conversationError ||
          new Error(
            "Could not create conversation."
          );
      }

      conversationId =
        conversation.id;

      const {
        error: leadUpdateError,
      } = await serviceClient
        .from("leads")
        .update({
          conversation_id:
            conversationId,
        })
        .eq("id", lead.id);

      if (leadUpdateError) {
        throw leadUpdateError;
      }
    }

    const resendKey =
      Deno.env.get("RESEND_API_KEY");

    const emailFrom =
      Deno.env.get("EMAIL_FROM");

    const adminEmail =
      Deno.env.get("ADMIN_EMAIL");

    if (!resendKey) {
      throw new Error(
        "RESEND_API_KEY is not configured."
      );
    }

    if (!emailFrom) {
      throw new Error(
        "EMAIL_FROM is not configured."
      );
    }

    const business =
      String(
        lead.business ||
        lead.name ||
        "your enquiry"
      ).trim();

    const safeMessage =
      escapeHtml(message)
        .replaceAll("\n", "<br>");

    const resendResponse =
      await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${resendKey}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            from: emailFrom,
            to: [email],
            reply_to: [
              `reply+${conversationId}@gdstudio360.co.uk`,
            ],
            subject:
              `GD Studio 360 — ${business}`,
            text:
              `${message}\n\nGD Studio 360`,
            html: `
              <div style="
                max-width:640px;
                margin:auto;
                font-family:Arial,sans-serif;
                color:#172033;
                line-height:1.65
              ">
                <p>Hi ${escapeHtml(
                  lead.name || ""
                )},</p>

                <p>${safeMessage}</p>

                <p style="margin-top:28px">
                  GD Studio 360
                </p>
              </div>
            `,
          }),
        },
      );

    if (!resendResponse.ok) {
      const resendError =
        await resendResponse.text();

      console.error(
        "RESEND_ADMIN_REPLY_ERROR",
        resendError
      );

      throw new Error(
        "Resend could not send the email."
      );
    }

    const {
      error: messageError,
    } = await serviceClient
      .from("messages")
      .insert({
        conversation_id:
          conversationId,
        role: "human",
        channel: "email",
        content: message,
      });

    if (messageError) {
      throw messageError;
    }

    await serviceClient
      .from("audit_log")
      .insert({
        tenant_id: lead.tenant_id,
        actor_user_id:
          userData.user.id,
        actor_type: "user",
        action: "admin_email_reply_sent",
        entity_type: "conversation",
        entity_id: conversationId,
        details: {
          lead_id: lead.id,
          to: email,
        },
      });

    return Response.json(
      {
        ok: true,
        conversation_id:
          conversationId,
        reply_sent: true,
      },
      {
        headers: corsHeaders,
      },
    );

  } catch (error) {
    console.error(
      "ADMIN_INBOX_ERROR",
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
        headers: corsHeaders,
      },
    );
  }
});
