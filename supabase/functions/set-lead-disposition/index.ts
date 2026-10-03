import {
  createClient,
} from "npm:@supabase/supabase-js@2";


const corsHeaders = {
  "Access-Control-Allow-Origin":
    "*",

  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",

  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};


const ALLOWED_ACTIONS =
  new Set([
    "resubmit",
    "decline",
    "block",
    "restore",
    "unblock_restore",
  ]);


function cleanNote(
  value: unknown,
) {
  const note =
    String(
      value || "",
    )
      .trim()
      .slice(
        0,
        2000,
      );

  return note || null;
}


Deno.serve(
  async (
    req,
  ) => {

    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }


    try {

      const authHeader =
        req.headers.get(
          "Authorization",
        );


      if (
        !authHeader
      ) {
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


      if (
        !serviceKey
      ) {
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


      const serviceClient =
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
        data:
          userData,

        error:
          userError,
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
        data:
          admin,
      } =
        await serviceClient
          .from(
            "admin_users",
          )
          .select(
            "user_id",
          )
          .eq(
            "user_id",
            userData.user.id,
          )
          .maybeSingle();


      if (
        !admin
      ) {
        return Response.json(
          {
            ok:
              false,

            error:
              "Not authorised as an admin.",
          },
          {
            status:
              403,

            headers:
              corsHeaders,
          },
        );
      }


      const body =
        await req.json();


      const leadId =
        String(
          body?.lead_id ||
          "",
        ).trim();


      const action =
        String(
          body?.action ||
          "",
        ).trim();


      const note =
        cleanNote(
          body?.note,
        );


      if (
        !leadId
      ) {
        throw new Error(
          "Missing lead_id.",
        );
      }


      if (
        !ALLOWED_ACTIONS
          .has(
            action,
          )
      ) {
        throw new Error(
          "Invalid disposition action.",
        );
      }


      if (
        action ===
          "block" &&
        !note
      ) {
        return Response.json(
          {
            ok:
              false,

            error:
              "Add a short reason before blocking this client.",
          },
          {
            status:
              400,

            headers:
              corsHeaders,
          },
        );
      }


      const {
        data:
          lead,

        error:
          leadError,
      } =
        await serviceClient
          .from(
            "leads",
          )
          .select(
            "id, tenant_id, contact_id, name, business, email, phone, status, rejection_kind",
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
          "Lead not found.",
        );
      }


      const now =
        new Date()
          .toISOString();


      let contactId =
        lead.contact_id ||
        null;


      if (
        !contactId &&
        lead.email
      ) {
        const {
          data:
            matchingContact,
        } =
          await serviceClient
            .from(
              "contacts",
            )
            .select(
              "id",
            )
            .eq(
              "tenant_id",
              lead.tenant_id,
            )
            .ilike(
              "email",
              String(
                lead.email,
              ).trim(),
            )
            .is(
              "deleted_at",
              null,
            )
            .maybeSingle();


        contactId =
          matchingContact
            ?.id ||
          null;
      }


      if (
        action ===
          "restore" ||
        action ===
          "unblock_restore"
      ) {

        if (
          action ===
            "unblock_restore" &&
          contactId
        ) {
          const {
            error:
              unblockError,
          } =
            await serviceClient
              .from(
                "contacts",
              )
              .update({
                blocked:
                  false,

                blocked_at:
                  null,

                blocked_reason:
                  null,

                blocked_by_lead_id:
                  null,
              })
              .eq(
                "id",
                contactId,
              );


          if (
            unblockError
          ) {
            throw unblockError;
          }
        }


        const {
          error:
            restoreError,
        } =
          await serviceClient
            .from(
              "leads",
            )
            .update({
              status:
                "new",

              rejection_kind:
                null,

              rejection_note:
                null,

              rejected_at:
                null,
            })
            .eq(
              "id",
              lead.id,
            );


        if (
          restoreError
        ) {
          throw restoreError;
        }


        await serviceClient
          .from(
            "audit_log",
          )
          .insert({
            tenant_id:
              lead.tenant_id,

            actor_type:
              "user",

            actor_user_id:
              userData.user.id,

            action:
              action ===
                "unblock_restore"
                ? "lead_unblocked_and_restored"
                : "lead_restored",

            entity_type:
              "lead",

            entity_id:
              lead.id,

            details: {
              contact_id:
                contactId,

              admin_user_id:
                userData.user.id,
            },
          });


        return Response.json(
          {
            ok:
              true,

            status:
              "new",

            unblocked:
              action ===
              "unblock_restore",
          },
          {
            headers:
              corsHeaders,
          },
        );
      }


      const rejectionKind =
        action ===
          "resubmit"
          ? "resubmit_requested"
          : action ===
              "block"
            ? "blocked"
            : "declined";


      const {
        error:
          rejectError,
      } =
        await serviceClient
          .from(
            "leads",
          )
          .update({
            status:
              "rejected",

            rejection_kind:
              rejectionKind,

            rejection_note:
              note,

            rejected_at:
              now,
          })
          .eq(
            "id",
            lead.id,
          );


      if (
        rejectError
      ) {
        throw rejectError;
      }


      if (
        action ===
          "block"
      ) {

        if (
          !contactId
        ) {
          throw new Error(
            "This lead does not have a contact record to block.",
          );
        }


        const {
          error:
            blockError,
        } =
          await serviceClient
            .from(
              "contacts",
            )
            .update({
              blocked:
                true,

              blocked_at:
                now,

              blocked_reason:
                note,

              blocked_by_lead_id:
                lead.id,
            })
            .eq(
              "id",
              contactId,
            );


        if (
          blockError
        ) {
          throw blockError;
        }
      }


      await serviceClient
        .from(
          "audit_log",
        )
        .insert({
          tenant_id:
            lead.tenant_id,

          actor_type:
              "user",

            actor_user_id:
              userData.user.id,

            action:
            `lead_${rejectionKind}`,

          entity_type:
            "lead",

          entity_id:
            lead.id,

          details: {
            contact_id:
              contactId,

            rejection_kind:
              rejectionKind,

            note,

            admin_user_id:
              userData.user.id,
          },
        });


      return Response.json(
        {
          ok:
            true,

          status:
            "rejected",

          rejection_kind:
            rejectionKind,

          contact_blocked:
            action ===
            "block",
        },
        {
          headers:
            corsHeaders,
        },
      );


    } catch (
      error
    ) {

      console.error(
        "SET_LEAD_DISPOSITION_ERROR",
        error,
      );


      return Response.json(
        {
          ok:
            false,

          error:
            error instanceof Error
              ? error.message
              : "Unknown error.",
        },
        {
          status:
            400,

          headers:
            corsHeaders,
        },
      );
    }
  },
);
