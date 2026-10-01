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
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const authHeader =
      req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error(
        "Missing authorization.",
      );
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL")!;

    const publishableKey =
      Deno.env.get("SUPABASE_ANON_KEY") ||
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

    const serviceClient =
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
      await userClient.auth.getUser();

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
      await serviceClient
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

    const testMode =
      (
        Deno.env.get(
          "SUMUP_TEST_MODE",
        ) || ""
      )
        .trim()
        .toLowerCase() ===
      "true";

    return Response.json(
      {
        ok: true,
        sumup_test_mode:
          testMode,
        payment_environment:
          testMode
            ? "sandbox"
            : "live",
      },
      {
        headers:
          corsHeaders,
      },
    );

  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 400,
        headers: corsHeaders,
      },
    );
  }
});
