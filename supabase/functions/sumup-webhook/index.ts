import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const payload = await req.json();

    if (
      payload?.event_type !== "CHECKOUT_STATUS_CHANGED" ||
      !payload?.id
    ) {
      return new Response("", { status: 204 });
    }

    const testMode =
      (Deno.env.get("SUMUP_TEST_MODE") || "").toLowerCase() === "true";

    const sumupKey = testMode
      ? Deno.env.get("SUMUP_SANDBOX_API_KEY")
      : Deno.env.get("SUMUP_API_KEY");

    if (!sumupKey) {
      throw new Error("SumUp API key is not configured.");
    }

    const verifyResponse = await fetch(
      `https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(payload.id)}`,
      {
        headers: { Authorization: `Bearer ${sumupKey}` },
      },
    );

    if (!verifyResponse.ok) {
      console.error(
        "SUMUP_VERIFY_FAILED",
        verifyResponse.status,
        await verifyResponse.text(),
      );
      throw new Error("Could not verify SumUp checkout.");
    }

    const checkout = await verifyResponse.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SECRET_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, name, business, email, package, care_plan, deposit_amount, status")
      .eq("sumup_checkout_id", checkout.id)
      .maybeSingle();

    if (leadError || !lead) {
      return new Response("", { status: 204 });
    }

    const expectedAmount = Number((lead.deposit_amount / 100).toFixed(2));
    const amountMatches = Number(checkout.amount) === expectedAmount;
    const currencyMatches = checkout.currency === "GBP";

    if (
      checkout.status !== "PAID" ||
      !amountMatches ||
      !currencyMatches
    ) {
      return new Response("", { status: 204 });
    }

    // Claim this payment only once.
    // Repeated SumUp webhooks will not send duplicate emails.
    const paidAt = new Date().toISOString();

    const { data: paidLead, error: updateError } = await supabase
      .from("leads")
      .update({
        status: "deposit_paid",
        deposit_paid_at: paidAt,
      })
      .eq("id", lead.id)
      .neq("status", "deposit_paid")
      .select("id, name, business, email, package, care_plan, deposit_amount")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    // Already processed before.
    if (!paidLead) {
      return new Response("", { status: 204 });
    }

    const resendKey = Deno.env.get("RESEND_API_KEY");
    const emailFrom = Deno.env.get("EMAIL_FROM");
    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    const siteUrl = (Deno.env.get("SITE_URL") || "").replace(/\/$/, "");

    if (resendKey && emailFrom && adminEmail) {
      const deposit = `£${(paidLead.deposit_amount / 100).toFixed(2)}`;

      const clientHtml = `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033;line-height:1.6">
          <h2>Deposit received — your project is confirmed</h2>

          <p>Hi ${escapeHtml(paidLead.name)},</p>

          <p>
            Thank you. Your project deposit has been received successfully
            through SumUp.
          </p>

          <p>
            <strong>Business:</strong> ${escapeHtml(paidLead.business)}<br>
            <strong>Package:</strong> ${escapeHtml(paidLead.package)}<br>
            <strong>Care plan:</strong> ${escapeHtml(paidLead.care_plan || "No care plan")}<br>
            <strong>Deposit received:</strong> ${deposit}
          </p>

          <p>
            Your GD TradeWeb project is now confirmed.
            I’ll contact you regarding the content, access details and
            anything else needed to begin the build.
          </p>

          <p>GD TradeWeb</p>
        </div>
      `;

      const adminHtml = `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033;line-height:1.6">
          <h2>Deposit received</h2>

          <p>
            <strong>Business:</strong> ${escapeHtml(paidLead.business)}<br>
            <strong>Client:</strong> ${escapeHtml(paidLead.name)}<br>
            <strong>Email:</strong> ${escapeHtml(paidLead.email)}<br>
            <strong>Package:</strong> ${escapeHtml(paidLead.package)}<br>
            <strong>Care plan:</strong> ${escapeHtml(paidLead.care_plan || "No care plan")}<br>
            <strong>Deposit:</strong> ${deposit}
          </p>

          ${
            siteUrl
              ? `<p><a href="${siteUrl}/admin.html">Open GD TradeWeb Admin</a></p>`
              : ""
          }
        </div>
      `;

      const results = await Promise.all([
        sendEmail(resendKey, {
          from: emailFrom,
          reply_to: [adminEmail],
          to: [paidLead.email],
          subject: "GD TradeWeb — deposit received",
          html: clientHtml,
        }),

        sendEmail(resendKey, {
          from: emailFrom,
          to: [adminEmail],
          subject: `Deposit received — ${paidLead.business} — ${deposit}`,
          html: adminHtml,
        }),
      ]);

      console.log(
        "DEPOSIT_EMAILS",
        JSON.stringify({
          client: results[0],
          admin: results[1],
        }),
      );
    } else {
      console.error("DEPOSIT_EMAIL_CONFIG_MISSING");
    }

    return new Response("", { status: 204 });
  } catch (error) {
    console.error(
      "SUMUP_WEBHOOK_ERROR",
      error instanceof Error ? error.message : error,
    );

    return new Response("", { status: 500 });
  }
});

async function sendEmail(
  resendKey: string,
  body: Record<string, unknown>,
) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error(
      "RESEND_SEND_FAILED",
      response.status,
      await response.text(),
    );
    return false;
  }

  return true;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
