import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token) throw new Error("Missing payment token.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SECRET_KEY")!;
    const sumupKey = Deno.env.get("SUMUP_API_KEY");
    const merchantCode = Deno.env.get("SUMUP_MERCHANT_CODE");
    const siteUrl = (Deno.env.get("SITE_URL") || "").replace(/\/$/, "");

    if (!sumupKey) throw new Error("SUMUP_API_KEY is not configured.");
    if (!merchantCode) throw new Error("SUMUP_MERCHANT_CODE is not configured.");
    if (!siteUrl) throw new Error("SITE_URL is not configured.");

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: lead, error: leadError } = await serviceClient
      .from("leads")
      .select("*")
      .eq("payment_token", token)
      .single();

    if (leadError || !lead) {
      return Response.json(
        { ok: false, error: "This payment request is invalid." },
        { status: 404, headers: corsHeaders },
      );
    }

    if (lead.status === "deposit_paid") {
      return Response.json(
        { ok: false, already_paid: true, error: "This deposit is already paid." },
        { status: 409, headers: corsHeaders },
      );
    }

    if (!["approved", "deposit_sent"].includes(lead.status)) {
      return Response.json(
        { ok: false, error: "This payment request is not active." },
        { status: 409, headers: corsHeaders },
      );
    }

    if (!lead.deposit_amount || lead.deposit_amount < 1) {
      throw new Error("Deposit amount is missing.");
    }

    // Hosted Checkout sessions are short-lived. Reuse only a very recent one.
    const createdAt = lead.sumup_checkout_created_at
      ? new Date(lead.sumup_checkout_created_at).getTime()
      : 0;
    const ageMs = Date.now() - createdAt;

    if (
      lead.sumup_checkout_id &&
      lead.sumup_checkout_created_at &&
      ageMs < 20 * 60 * 1000
    ) {
      const verifyResponse = await fetch(
        `https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(lead.sumup_checkout_id)}`,
        {
          headers: { Authorization: `Bearer ${sumupKey}` },
        },
      );

      if (verifyResponse.ok) {
        const existing = await verifyResponse.json();
        if (
          existing.status === "PENDING" &&
          existing.hosted_checkout_url
        ) {
          return Response.json(
            {
              ok: true,
              checkout_url: existing.hosted_checkout_url,
              reused: true,
            },
            { headers: corsHeaders },
          );
        }
      }
    }

    const checkoutReference = `gd-${lead.id.replaceAll("-", "").slice(0, 20)}-${Date.now()}`;
    const amount = Number((lead.deposit_amount / 100).toFixed(2));

    const webhookUrl =
      `${supabaseUrl}/functions/v1/sumup-webhook`;

    const response = await fetch("https://api.sumup.com/v0.1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sumupKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        checkout_reference: checkoutReference,
        amount,
        currency: "GBP",
        merchant_code: merchantCode,
        description: `GD TradeWeb deposit — ${lead.business}`,
        return_url: webhookUrl,
        redirect_url: `${siteUrl}/payment-success.html?token=${encodeURIComponent(token)}`,
        hosted_checkout: { enabled: true },
      }),
    });

    const checkout = await response.json();

    if (!response.ok) {
      throw new Error(
        checkout?.message ||
        checkout?.error_message ||
        "SumUp could not create the checkout.",
      );
    }

    if (!checkout.id || !checkout.hosted_checkout_url) {
      throw new Error("SumUp did not return a Hosted Checkout URL.");
    }

    const { error: updateError } = await serviceClient
      .from("leads")
      .update({
        sumup_checkout_id: checkout.id,
        sumup_checkout_created_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    if (updateError) throw updateError;

    return Response.json(
      {
        ok: true,
        checkout_url: checkout.hosted_checkout_url,
        reused: false,
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
