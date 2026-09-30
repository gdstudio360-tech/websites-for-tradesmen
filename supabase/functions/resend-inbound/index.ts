import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@6.17.0";

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
    });
  }

  try {
    const resendKey =
      Deno.env.get("RESEND_API_KEY");

    const webhookSecret =
      Deno.env.get("RESEND_WEBHOOK_SECRET");

    const emailFrom =
      Deno.env.get("EMAIL_FROM");

    const adminEmail =
      Deno.env.get("ADMIN_EMAIL");

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL")!;

    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SECRET_KEY");

    if (
      !resendKey ||
      !webhookSecret ||
      !emailFrom ||
      !adminEmail ||
      !serviceKey
    ) {
      throw new Error(
        "Required inbound email secrets are missing."
      );
    }

    const rawPayload = await req.text();

    const resend = new Resend(resendKey);

    const event = resend.webhooks.verify({
      payload: rawPayload,
      headers: {
        id: req.headers.get("svix-id") || "",
        timestamp:
          req.headers.get("svix-timestamp") || "",
        signature:
          req.headers.get("svix-signature") || "",
      },
      webhookSecret,
    });

    if (event.type !== "email.received") {
      return Response.json({
        ok: true,
        ignored: true,
      });
    }

    const emailId =
      String(event.data.email_id || "").trim();

    if (!emailId) {
      throw new Error(
        "Webhook did not contain email_id."
      );
    }

    const db = createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          persistSession: false,
        },
      },
    );

    const { data: duplicate } =
      await db
        .from("messages")
        .select("id")
        .eq("external_message_id", emailId)
        .maybeSingle();

    if (duplicate) {
      return Response.json({
        ok: true,
        duplicate: true,
      });
    }

    const receivedResponse =
      await fetch(
        `https://api.resend.com/emails/receiving/${emailId}`,
        {
          headers: {
            Authorization:
              `Bearer ${resendKey}`,
          },
        },
      );

    if (!receivedResponse.ok) {
      const errorText =
        await receivedResponse.text();

      console.error(
        "RESEND_RECEIVED_EMAIL_ERROR",
        errorText,
      );

      throw new Error(
        "Could not retrieve inbound email content."
      );
    }

    const received =
      await receivedResponse.json();

    const recipients = [
      ...(Array.isArray(received.to)
        ? received.to
        : []),
      ...(Array.isArray(received.received_for)
        ? received.received_for
        : []),
    ];

    let conversationId: string | null = null;

    for (const recipient of recipients) {
      const match =
        String(recipient).match(
          /reply\+([0-9a-f-]{36})@gdstudio360\.co\.uk/i
        );

      if (match) {
        conversationId = match[1];
        break;
      }
    }

    if (!conversationId) {
      console.log(
        "Inbound email has no GD Studio 360 conversation route:",
        recipients,
      );

      return Response.json({
        ok: true,
        ignored: true,
        reason: "No conversation route.",
      });
    }

    const {
      data: conversation,
      error: conversationError,
    } = await db
      .from("conversations")
      .select("id, tenant_id, contact_id")
      .eq("id", conversationId)
      .single();

    if (conversationError || !conversation) {
      throw new Error(
        "Conversation for inbound reply was not found."
      );
    }

    const bodyText =
      String(received.text || "").trim() ||
      stripHtml(
        String(received.html || "")
      ) ||
      "(Email contained no readable text.)";

    const sender =
      String(received.from || "").trim();

    const subject =
      String(received.subject || "").trim();

    const {
      error: messageError,
    } = await db
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "customer",
        channel: "email",
        content: bodyText,
        external_message_id: emailId,
      });

    if (messageError) {
      throw messageError;
    }

    await db
      .from("conversations")
      .update({
        status: "waiting_human",
        human_attention_required: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId);

    await db
      .from("audit_log")
      .insert({
        tenant_id: conversation.tenant_id,
        actor_type: "webhook",
        action: "customer_email_reply_received",
        entity_type: "conversation",
        entity_id: conversationId,
        details: {
          resend_email_id: emailId,
          from: sender,
          subject,
        },
      });

    const gmailCopyText =
      `Customer reply received\n\n` +
      `From: ${sender}\n` +
      `Subject: ${subject || "(no subject)"}\n\n` +
      bodyText;

    const forwardResponse =
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
            to: [adminEmail],
            reply_to: sender
              ? [sender]
              : undefined,
            subject:
              `Customer reply — ${
                subject || "GD Studio 360"
              }`,
            text: gmailCopyText,
            html: `
              <div style="
                max-width:680px;
                margin:auto;
                font-family:Arial,sans-serif;
                line-height:1.6;
                color:#172033
              ">
                <p>
                  <strong>Customer reply received</strong>
                </p>

                <p>
                  <strong>From:</strong>
                  ${escapeHtml(sender)}
                  <br>
                  <strong>Subject:</strong>
                  ${escapeHtml(
                    subject || "(no subject)"
                  )}
                </p>

                <hr>

                <p style="white-space:pre-wrap">
                  ${escapeHtml(bodyText)}
                </p>
              </div>
            `,
          }),
        },
      );

    if (!forwardResponse.ok) {
      console.error(
        "GMAIL_FORWARD_ERROR",
        await forwardResponse.text(),
      );
    }

    return Response.json({
      ok: true,
      conversation_id: conversationId,
    });

  } catch (error) {
    console.error(
      "RESEND_INBOUND_ERROR",
      error,
    );

    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error.",
      },
      { status: 400 },
    );
  }
});
