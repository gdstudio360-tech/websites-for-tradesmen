import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEPOSITS: Record<string, number> = {
  "Starter — £249": 12450,
  "Business — £399": 19950,
  "Pro — £599": 29950,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const publishableKey =
      Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SECRET_KEY")!;

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) throw new Error("Invalid admin session.");

    const { data: admin } = await serviceClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (!admin) {
      return Response.json(
        { ok: false, error: "Not authorised as an admin." },
        { status: 403, headers: corsHeaders },
      );
    }

    const { lead_id } = await req.json();
    if (!lead_id) throw new Error("Missing lead_id.");

    const { data: lead, error: leadError } = await serviceClient
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) throw new Error("Lead not found.");

    const amount = DEPOSITS[lead.package];
    if (!amount) {
      return Response.json(
        {
          ok: false,
          error: "Choose Starter, Business or Pro before approving this project.",
        },
        { status: 400, headers: corsHeaders },
      );
    }

    const siteUrl = (Deno.env.get("SITE_URL") || "").replace(/\/$/, "");
    if (!siteUrl) throw new Error("SITE_URL is not configured.");

    const paymentToken = lead.payment_token || crypto.randomUUID();
    const paymentPageUrl =
      `${siteUrl}/pay-deposit.html?token=${encodeURIComponent(paymentToken)}`;
    const now = new Date().toISOString();

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const emailFrom = Deno.env.get("EMAIL_FROM");

    let emailSent = false;

    const { error: updateError } = await serviceClient
      .from("leads")
      .update({
        status: resendKey && emailFrom ? "deposit_sent" : "approved",
        deposit_amount: amount,
        deposit_url: paymentPageUrl,
        payment_token: paymentToken,
        approved_at: lead.approved_at || now,
      })
      .eq("id", lead.id);

    if (updateError) throw updateError;

    if (resendKey && emailFrom) {
      const termsUrl = `${siteUrl}/terms.html`;
      const formattedDeposit = `£${(amount / 100).toFixed(2)}`;

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom,
          reply_to: ["gdstudio360@gmail.com"],
          to: [lead.email],
          subject: `GD TradeWeb — ${lead.business} project approved`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033;line-height:1.6">
              <h2>Your website project has been approved</h2>
              <p>Hi ${escapeHtml(lead.name)},</p>
              <p>Thanks for your enquiry. I’m happy to take on the project.</p>
              <p>
                <strong>Package:</strong> ${escapeHtml(lead.package)}<br>
                <strong>Deposit:</strong> ${formattedDeposit}
              </p>
              <p>
                Use the secure payment page below when you are ready.
                The SumUp checkout itself is created only when you click through to pay,
                so you always receive a fresh payment session.
              </p>
              <p style="margin:28px 0">
                <a href="${paymentPageUrl}" style="background:#ffd83d;color:#111;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:8px">
                  Review & pay deposit
                </a>
              </p>
              <p><a href="${termsUrl}">Read the project terms</a></p>
              <p>GD TradeWeb</p>
            </div>
          `,
        }),
      });

      if (emailResponse.ok) {
        emailSent = true;
        await serviceClient
          .from("leads")
          .update({ approval_email_sent_at: new Date().toISOString() })
          .eq("id", lead.id);
      } else {
        await serviceClient
          .from("leads")
          .update({ status: "approved" })
          .eq("id", lead.id);
      }
    }

    return Response.json(
      {
        ok: true,
        payment_page_url: paymentPageUrl,
        email_sent: emailSent,
        deposit_amount: amount,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400, headers: corsHeaders },
    );
  }
});

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
