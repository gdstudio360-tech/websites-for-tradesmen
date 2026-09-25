import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // SumUp expects a fast 2xx response. We still verify the event by retrieving
  // the checkout from the SumUp API before changing project state.
  try {
    const payload = await req.json();

    if (
      payload?.event_type !== "CHECKOUT_STATUS_CHANGED" ||
      !payload?.id
    ) {
      return new Response("", { status: 204 });
    }

    const sumupKey = Deno.env.get("SUMUP_API_KEY");
    if (!sumupKey) throw new Error("SUMUP_API_KEY is not configured.");

    const verifyResponse = await fetch(
      `https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(payload.id)}`,
      {
        headers: { Authorization: `Bearer ${sumupKey}` },
      },
    );

    if (!verifyResponse.ok) {
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
      .select("id, deposit_amount, status")
      .eq("sumup_checkout_id", checkout.id)
      .maybeSingle();

    if (leadError || !lead) {
      return new Response("", { status: 204 });
    }

    const expectedAmount = Number((lead.deposit_amount / 100).toFixed(2));
    const amountMatches = Number(checkout.amount) === expectedAmount;
    const currencyMatches = checkout.currency === "GBP";

    if (checkout.status === "PAID" && amountMatches && currencyMatches) {
      await supabase
        .from("leads")
        .update({
          status: "deposit_paid",
          deposit_paid_at: new Date().toISOString(),
        })
        .eq("id", lead.id);
    }

    return new Response("", { status: 204 });
  } catch (error) {
    console.error(error);
    return new Response("", { status: 500 });
  }
});
