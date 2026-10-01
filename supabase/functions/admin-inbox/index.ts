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
      let conversationId =
        lead.conversation_id || null;

      /*
       * A normal website enquiry may exist before a
       * conversation has been created.
       *
       * Opening Reply in Admin starts the email
       * conversation automatically.
       */
      if (!conversationId) {
        const {
          data: conversation,
          error: conversationError,
        } = await serviceClient
          .from("conversations")
          .insert({
            tenant_id: lead.tenant_id,
            contact_id:
              lead.contact_id || null,
            channel: "email",
            status: "open",
            ai_enabled: false,
            human_attention_required: true,
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

        /*
         * Put the original website enquiry into
         * conversation history as the first
         * customer message.
         */
        const initialMessage =
          String(
            lead.message || ""
          ).trim();

        if (initialMessage) {
          const {
            error: initialMessageError,
          } = await serviceClient
            .from("messages")
            .insert({
              conversation_id:
                conversationId,
              role: "customer",
              channel: "website",
              content: initialMessage,
            });

          if (initialMessageError) {
            console.error(
              "INITIAL_LEAD_MESSAGE_ERROR",
              initialMessageError,
            );
          }
        }

        await serviceClient
          .from("audit_log")
          .insert({
            tenant_id: lead.tenant_id,
            actor_type: "system",
            action:
              "conversation_created_from_lead",
            entity_type: "conversation",
            entity_id: conversationId,
            details: {
              lead_id: lead.id,
              source: "admin_inbox",
            },
          });
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
          conversationId
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
            conversationId,
          messages: messages || [],
        },
        {
          headers: corsHeaders,
        },
      );
    }

    if (action === "send_preview") {
      const email =
        String(lead.email || "").trim();

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        throw new Error(
          "This customer does not have a valid email address."
        );
      }

      if (!lead.deposit_paid_at) {
        return Response.json(
          {
            ok: false,
            error:
              "The deposit must be paid before sending the project preview.",
          },
          {
            status: 409,
            headers: corsHeaders,
          },
        );
      }

      const rawPreviewUrl =
        String(
          lead.preview_url || ""
        ).trim();

      if (!rawPreviewUrl) {
        return Response.json(
          {
            ok: false,
            error:
              "Add and save the Preview URL before sending it to the client.",
          },
          {
            status: 400,
            headers: corsHeaders,
          },
        );
      }

      let previewUrl = "";

      try {
        const parsed =
          new URL(rawPreviewUrl);

        if (
          ![
            "http:",
            "https:",
          ].includes(
            parsed.protocol
          )
        ) {
          throw new Error();
        }

        previewUrl =
          parsed.toString();

      } catch (_) {
        return Response.json(
          {
            ok: false,
            error:
              "The saved Preview URL is not valid.",
          },
          {
            status: 400,
            headers: corsHeaders,
          },
        );
      }

      let conversationId =
        lead.conversation_id ||
        null;

      if (!conversationId) {
        const {
          data: conversation,
          error: conversationError,
        } =
          await serviceClient
            .from("conversations")
            .insert({
              tenant_id:
                lead.tenant_id,

              contact_id:
                lead.contact_id ||
                null,

              channel:
                "email",

              status:
                "open",

              ai_enabled:
                false,

              human_attention_required:
                true,
            })
            .select("id")
            .single();

        if (
          conversationError ||
          !conversation
        ) {
          throw (
            conversationError ||
            new Error(
              "Could not create conversation."
            )
          );
        }

        conversationId =
          conversation.id;

        const {
          error: leadUpdateError,
        } =
          await serviceClient
            .from("leads")
            .update({
              conversation_id:
                conversationId,
            })
            .eq(
              "id",
              lead.id
            );

        if (leadUpdateError) {
          throw leadUpdateError;
        }

        const initialMessage =
          String(
            lead.message || ""
          ).trim();

        if (initialMessage) {
          const {
            error: initialMessageError,
          } =
            await serviceClient
              .from("messages")
              .insert({
                conversation_id:
                  conversationId,

                role:
                  "customer",

                channel:
                  "website",

                content:
                  initialMessage,
              });

          if (
            initialMessageError
          ) {
            console.error(
              "PREVIEW_INITIAL_MESSAGE_ERROR",
              initialMessageError
            );
          }
        }
      }

      const resendKey =
        Deno.env.get(
          "RESEND_API_KEY"
        );

      const emailFrom =
        Deno.env.get(
          "EMAIL_FROM"
        );

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
          "your website"
        ).trim();

      const customerName =
        String(
          lead.name || ""
        ).trim();

      const conversationText =
        `Your website preview is ready.\n\n` +
        `Preview: ${previewUrl}\n\n` +
        `Please review the website and reply with any changes, ` +
        `or confirm that you are happy to proceed.`;

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

            body:
              JSON.stringify({
                from:
                  emailFrom,

                to: [
                  email,
                ],

                reply_to: [
                  `reply+${conversationId}@gdstudio360.co.uk`,
                ],

                subject:
                  `GD Studio 360 — ${business} website preview`,

                text:
                  `Hi ${customerName},\n\n` +
                  `${conversationText}\n\n` +
                  `GD Studio 360`,

                html: `
                  <div style="
                    max-width:640px;
                    margin:auto;
                    font-family:Arial,sans-serif;
                    color:#172033;
                    line-height:1.65
                  ">

                    <h2 style="
                      margin-bottom:18px
                    ">
                      Your website preview is ready
                    </h2>

                    <p>
                      Hi ${escapeHtml(customerName)},
                    </p>

                    <p>
                      Your website is ready for review.
                      Please take a look and reply with
                      any changes you would like,
                      or confirm that you are happy
                      to proceed.
                    </p>

                    <p style="
                      margin:28px 0
                    ">
                      <a
                        href="${escapeHtml(previewUrl)}"
                        style="
                          display:inline-block;
                          padding:14px 20px;
                          border-radius:9px;
                          background:#ffd83d;
                          color:#111;
                          text-decoration:none;
                          font-weight:700
                        "
                      >
                        Open website preview
                      </a>
                    </p>

                    <p style="
                      font-size:13px;
                      color:#687386
                    ">
                      Preview link:
                      <br>
                      <a href="${escapeHtml(previewUrl)}">
                        ${escapeHtml(previewUrl)}
                      </a>
                    </p>

                    <p style="
                      margin-top:28px
                    ">
                      GD Studio 360
                    </p>

                  </div>
                `,
              }),
          },
        );

      if (!resendResponse.ok) {
        const resendError =
          await resendResponse
            .text();

        console.error(
          "RESEND_PREVIEW_ERROR",
          resendError
        );

        throw new Error(
          "The preview email could not be sent."
        );
      }

      const {
        error: messageError,
      } =
        await serviceClient
          .from("messages")
          .insert({
            conversation_id:
              conversationId,

            role:
              "human",

            channel:
              "email",

            content:
              conversationText,
          });

      if (messageError) {
        console.error(
          "PREVIEW_CONVERSATION_MESSAGE_ERROR",
          messageError
        );
      }

      const {
        error: statusError,
      } =
        await serviceClient
          .from("leads")
          .update({
            status:
              "review",
          })
          .eq(
            "id",
            lead.id
          );

      if (statusError) {
        throw statusError;
      }

      await serviceClient
        .from("audit_log")
        .insert({
          tenant_id:
            lead.tenant_id,

          actor_user_id:
            userData.user.id,

          actor_type:
            "user",

          action:
            "website_preview_sent",

          entity_type:
            "conversation",

          entity_id:
            conversationId,

          details: {
            lead_id:
              lead.id,

            to:
              email,

            preview_url:
              previewUrl,
          },
        });

      return Response.json(
        {
          ok: true,
          preview_sent: true,
          status: "review",
          preview_url:
            previewUrl,
          conversation_id:
            conversationId,
        },
        {
          headers:
            corsHeaders,
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
