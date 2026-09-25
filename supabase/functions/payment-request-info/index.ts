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

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: lead, error } = await supabase
      .from("leads")
      .select("business, package, deposit_amount, status")
      .eq("payment_token", token)
      .single();

    if (error || !lead) {
      return Response.json(
        { ok: false, error: "Payment request not found." },
        { status: 404, headers: corsHeaders },
      );
    }

    return Response.json(
      {
        ok: true,
        business: lead.business,
        package: lead.package,
        deposit_amount: lead.deposit_amount,
        status: lead.status,
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
