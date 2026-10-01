import {
  createClient,
} from "npm:@supabase/supabase-js@2";

import {
  getSumupTestMode,
} from "../_shared/payment-mode.ts";

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
      )!;

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
            persistSession: false,
          },
        },
      );

    const db =
      createClient(
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

    if (
      typeof body?.test_mode !==
      "boolean"
    ) {
      throw new Error(
        "Missing payment mode.",
      );
    }

    const targetTestMode =
      body.test_mode;

    const requiredWord =
      targetTestMode
        ? "TEST"
        : "LIVE";

    if (
      String(
        body?.confirmation || "",
      )
        .trim()
        .toUpperCase() !==
      requiredWord
    ) {
      return Response.json(
        {
          ok: false,
          error:
            `Type ${requiredWord} to confirm.`,
        },
        {
          status: 400,
          headers: corsHeaders,
        },
      );
    }

    /*
     * Do not switch environments while
     * an unpaid payment request is active.
     */
    const {
      data: pendingPayments,
    } =
      await db
        .from("leads")
        .select(
          "id, business, status",
        )
        .in(
          "status",
          [
            "approved",
            "deposit_sent",
            "balance_due",
          ],
        )
        .limit(1);

    if (
      pendingPayments &&
      pendingPayments.length
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "There is an active unpaid payment request. Finish or remove it before switching SumUp mode.",
        },
        {
          status: 409,
          headers: corsHeaders,
        },
      );
    }

    if (targetTestMode) {
      if (
        !Deno.env.get(
          "SUMUP_SANDBOX_API_KEY",
        ) ||
        !Deno.env.get(
          "SUMUP_SANDBOX_MERCHANT_CODE",
        )
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "SumUp sandbox credentials are not configured.",
          },
          {
            status: 409,
            headers: corsHeaders,
          },
        );
      }
    } else {
      if (
        !Deno.env.get(
          "SUMUP_API_KEY",
        ) ||
        !Deno.env.get(
          "SUMUP_MERCHANT_CODE",
        )
      ) {
        return Response.json(
          {
            ok: false,
            error:
              "SumUp LIVE credentials are not configured.",
          },
          {
            status: 409,
            headers: corsHeaders,
          },
        );
      }
    }

    const previousMode =
      await getSumupTestMode();

    const {
      error: updateError,
    } =
      await db
        .from("payment_settings")
        .upsert({
          id: 1,
          sumup_test_mode:
            targetTestMode,
          updated_at:
            new Date()
              .toISOString(),
          updated_by:
            userData.user.id,
        });

    if (updateError) {
      throw updateError;
    }

    await db
      .from("audit_log")
      .insert({
        actor_user_id:
          userData.user.id,
        actor_type:
          "user",
        action:
          "sumup_payment_mode_changed",
        entity_type:
          "payment_settings",
        details: {
          previous:
            previousMode
              ? "test"
              : "live",
          current:
            targetTestMode
              ? "test"
              : "live",
        },
      });

    return Response.json(
      {
        ok: true,
        sumup_test_mode:
          targetTestMode,
      },
      {
        headers: corsHeaders,
      },
    );

  } catch (error) {
    console.error(
      "ADMIN_PAYMENT_MODE_ERROR",
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
        headers: corsHeaders,
      },
    );
  }
});
