import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PACKAGE_TOTALS: Record<string, number> = {
  "Starter — £249": 24900,
  "Business — £399": 39900,
  "Pro — £599": 59900,
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

    const { data: admin } =
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

    const { lead_id } =
      await req.json();

    if (!lead_id) {
      throw new Error(
        "Missing lead_id.",
      );
    }

    const {
      data: lead,
      error: leadError,
    } =
      await serviceClient
        .from("leads")
        .select("*")
        .eq("id", lead_id)
        .single();

    if (
      leadError ||
      !lead
    ) {
      throw new Error(
        "Lead not found.",
      );
    }

    if (
      lead.balance_paid_at ||
      lead.status ===
        "completed"
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "This project has already been paid in full.",
        },
        {
          status: 409,
          headers: corsHeaders,
        },
      );
    }

    if (
      !lead.deposit_paid_at
    ) {
      return Response.json(
        {
          ok: false,
          error:
            "The deposit has not been recorded as paid yet.",
        },
        {
          status: 409,
          headers: corsHeaders,
        },
      );
    }

    const projectTotal =
      Number(
        lead.project_total ||
        PACKAGE_TOTALS[
          lead.package
        ] ||
        0,
      );

    const depositPaid =
      Number(
        lead.deposit_amount ||
        0,
      );

    const balanceAmount =
      projectTotal -
      depositPaid;

    if (
      projectTotal < 1
    ) {
      throw new Error(
        "Project total is missing.",
      );
    }

    if (
      balanceAmount < 1
    ) {
      throw new Error(
        "There is no remaining balance to collect.",
      );
    }

    const siteUrl =
      (
        Deno.env.get(
          "SITE_URL",
        ) || ""
      ).replace(/\/$/, "");

    if (!siteUrl) {
      throw new Error(
        "SITE_URL is not configured.",
      );
    }

    const token =
      lead.balance_payment_token ||
      crypto.randomUUID();

    const paymentUrl =
      `${siteUrl}/pay-balance.html?token=${
        encodeURIComponent(
          token,
        )
      }`;

    const now =
      new Date()
        .toISOString();

    const {
      error: updateError,
    } =
      await serviceClient
        .from("leads")
        .update({
          status:
            "balance_due",

          project_total:
            projectTotal,

          balance_amount:
            balanceAmount,

          balance_url:
            paymentUrl,

          balance_payment_token:
            token,

          balance_sumup_checkout_id:
            null,

          balance_sumup_checkout_created_at:
            null,

          balance_sent_at:
            now,
        })
        .eq(
          "id",
          lead.id,
        );

    if (updateError) {
      throw updateError;
    }

    const resendKey =
      Deno.env.get(
        "RESEND_API_KEY",
      );

    const emailFrom =
      Deno.env.get(
        "EMAIL_FROM",
      );

    let emailSent = false;

    if (
      resendKey &&
      emailFrom
    ) {
      const preview =
        lead.preview_url
          ? `
            <p>
              You can review your website here:
              <br>
              <a href="${escapeHtml(lead.preview_url)}">
                Open website preview
              </a>
            </p>
          `
          : "";

      const response =
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
              reply_to: [
                "gdstudio360@gmail.com",
              ],
              to: [
                lead.email,
              ],
              subject:
                `GD Studio 360 — final payment for ${lead.business}`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033;line-height:1.6">
                  <h2>Your website is ready</h2>

                  <p>
                    Hi ${escapeHtml(lead.name)},
                  </p>

                  <p>
                    Thank you for reviewing the website.
                    The project is now ready for the
                    final payment.
                  </p>

                  ${preview}

                  <p>
                    <strong>Project total:</strong>
                    ${money(projectTotal)}
                    <br>

                    <strong>Deposit received:</strong>
                    ${money(depositPaid)}
                    <br>

                    <strong>Remaining balance:</strong>
                    ${money(balanceAmount)}
                  </p>

                  <p style="margin:28px 0">
                    <a
                      href="${paymentUrl}"
                      style="background:#ffd83d;color:#111;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:8px"
                    >
                      Pay remaining balance
                    </a>
                  </p>

                  <p>
                    Thank you,
                    <br>
                    GD Studio 360
                  </p>
                </div>
              `,
            }),
          },
        );

      if (
        response.ok
      ) {
        emailSent = true;

        await serviceClient
          .from("leads")
          .update({
            final_payment_email_sent_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            lead.id,
          );
      }
    }

    return Response.json(
      {
        ok: true,
        payment_page_url:
          paymentUrl,
        project_total:
          projectTotal,
        deposit_paid:
          depositPaid,
        balance_amount:
          balanceAmount,
        email_sent:
          emailSent,
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


function money(
  pence: number,
) {
  return `£${
    (
      Number(pence) /
      100
    ).toFixed(2)
  }`;
}


function escapeHtml(
  value: unknown,
) {
  return String(
    value ?? "",
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll(
      '"',
      "&quot;",
    )
    .replaceAll(
      "'",
      "&#039;",
    );
}
