import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(
      "ok",
      { headers: corsHeaders },
    );
  }

  try {
    const testMode =
      (
        Deno.env.get(
          "SUMUP_TEST_MODE",
        ) || ""
      )
        .trim()
        .toLowerCase() ===
      "true";

    if (!testMode) {
      return Response.json(
        {
          ok: false,
          error:
            "Client deletion is disabled while payments are LIVE.",
        },
        {
          status: 403,
          headers: corsHeaders,
        },
      );
    }

    const authHeader =
      req.headers.get(
        "Authorization",
      );

    if (!authHeader) {
      throw new Error(
        "Missing authorization.",
      );
    }

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      )!;

    const publishableKey =
      Deno.env.get(
        "SUPABASE_ANON_KEY",
      ) ||
      Deno.env.get(
        "SUPABASE_PUBLISHABLE_KEY",
      )!;

    const serviceKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      ) ||
      Deno.env.get(
        "SUPABASE_SECRET_KEY",
      );

    if (!serviceKey) {
      throw new Error(
        "Supabase service key is not configured.",
      );
    }

    const userClient =
      createClient(
        supabaseUrl,
        publishableKey,
        {
          global: {
            headers: {
              Authorization:
                authHeader,
            },
          },
          auth: {
            persistSession:
              false,
          },
        },
      );

    const db =
      createClient(
        supabaseUrl,
        serviceKey,
        {
          auth: {
            persistSession:
              false,
          },
        },
      );

    const {
      data: userData,
      error: userError,
    } =
      await userClient
        .auth
        .getUser();

    if (
      userError ||
      !userData.user
    ) {
      throw new Error(
        "Invalid admin session.",
      );
    }

    const {
      data: admin,
    } =
      await db
        .from("admin_users")
        .select("user_id")
        .eq(
          "user_id",
          userData.user.id,
        )
        .maybeSingle();

    if (!admin) {
      return Response.json(
        {
          ok: false,
          error:
            "Not authorised as an admin.",
        },
        {
          status: 403,
          headers: corsHeaders,
        },
      );
    }

    const body =
      await req.json();

    const leadId =
      String(
        body?.lead_id || "",
      ).trim();

    if (!leadId) {
      throw new Error(
        "Missing lead_id.",
      );
    }

    const {
      data: lead,
      error: leadError,
    } =
      await db
        .from("leads")
        .select(
          "id, business, name, email, conversation_id, contact_id",
        )
        .eq(
          "id",
          leadId,
        )
        .single();

    if (
      leadError ||
      !lead
    ) {
      throw new Error(
        "Client was not found.",
      );
    }

    const conversationId =
      lead.conversation_id ||
      null;

    const contactId =
      lead.contact_id ||
      null;

    /*
     * Delete the CRM lead first.
     * Payment/check-out fields live on this row too.
     */
    const {
      error: deleteLeadError,
    } =
      await db
        .from("leads")
        .delete()
        .eq(
          "id",
          lead.id,
        );

    if (deleteLeadError) {
      throw deleteLeadError;
    }

    /*
     * Delete the dedicated conversation.
     * messages.conversation_id has ON DELETE CASCADE,
     * so all chat/email history goes with it.
     */
    if (conversationId) {
      const {
        error:
          deleteConversationError,
      } =
        await db
          .from("conversations")
          .delete()
          .eq(
            "id",
            conversationId,
          );

      if (
        deleteConversationError
      ) {
        console.error(
          "DELETE_TEST_CONVERSATION_ERROR",
          deleteConversationError,
        );
      }
    }

    /*
     * Remove the contact only when nothing else
     * in the CRM is using it.
     */
    let contactDeleted =
      false;

    if (contactId) {
      const {
        count: leadCount,
      } =
        await db
          .from("leads")
          .select(
            "id",
            {
              count: "exact",
              head: true,
            },
          )
          .eq(
            "contact_id",
            contactId,
          );

      const {
        count:
          conversationCount,
      } =
        await db
          .from("conversations")
          .select(
            "id",
            {
              count: "exact",
              head: true,
            },
          )
          .eq(
            "contact_id",
            contactId,
          );

      if (
        Number(
          leadCount || 0,
        ) === 0 &&
        Number(
          conversationCount || 0,
        ) === 0
      ) {
        /*
         * Remove test-only related records
         * before removing the orphan contact.
         */
        await db
          .from(
            "consent_events",
          )
          .delete()
          .eq(
            "contact_id",
            contactId,
          );

        await db
          .from(
            "ai_recommendations",
          )
          .delete()
          .eq(
            "contact_id",
            contactId,
          );

        const {
          error:
            contactDeleteError,
        } =
          await db
            .from("contacts")
            .delete()
            .eq(
              "id",
              contactId,
            );

        if (
          contactDeleteError
        ) {
          console.error(
            "DELETE_TEST_CONTACT_ERROR",
            contactDeleteError,
          );
        } else {
          contactDeleted =
            true;
        }
      }
    }

    return Response.json(
      {
        ok: true,

        deleted: {
          lead_id:
            lead.id,

          business:
            lead.business,

          conversation:
            Boolean(
              conversationId,
            ),

          contact:
            contactDeleted,
        },
      },
      {
        headers:
          corsHeaders,
      },
    );

  } catch (error) {
    console.error(
      "DELETE_TEST_CLIENT_ERROR",
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
      {
        status: 400,
        headers:
          corsHeaders,
      },
    );
  }
});
