import {
  createClient,
} from "npm:@supabase/supabase-js@2";

export async function getSumupTestMode() {
  const fallback =
    (
      Deno.env.get(
        "SUMUP_TEST_MODE",
      ) || ""
    )
      .trim()
      .toLowerCase() ===
    "true";

  const supabaseUrl =
    Deno.env.get(
      "SUPABASE_URL",
    );

  const serviceKey =
    Deno.env.get(
      "SUPABASE_SERVICE_ROLE_KEY",
    ) ||
    Deno.env.get(
      "SUPABASE_SECRET_KEY",
    );

  if (
    !supabaseUrl ||
    !serviceKey
  ) {
    return fallback;
  }

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
    data,
    error,
  } =
    await db
      .from("payment_settings")
      .select("sumup_test_mode")
      .eq("id", 1)
      .maybeSingle();

  if (
    error ||
    typeof data?.sumup_test_mode !==
      "boolean"
  ) {
    return fallback;
  }

  return data.sumup_test_mode;
}
