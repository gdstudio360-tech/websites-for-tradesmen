import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ensureLeadConversation,
  logClientSystemMessage,
} from "../_shared/conversation-log.ts";

Deno.serve(async (req) => {
  try {
    const payload =
      await req.json();

    if (
      payload?.event_type !==
        "CHECKOUT_STATUS_CHANGED" ||
      !payload?.id
    ) {
      return new Response(
        "",
        { status: 204 },
      );
    }

    const testMode =
      (
        Deno.env.get(
          "SUMUP_TEST_MODE",
        ) || ""
      ).toLowerCase() ===
      "true";

    const sumupKey =
      testMode
        ? Deno.env.get(
            "SUMUP_SANDBOX_API_KEY",
          )
        : Deno.env.get(
            "SUMUP_API_KEY",
          );

    if (!sumupKey) {
      throw new Error(
        "SumUp API key is not configured.",
      );
    }

    const verifyResponse =
      await fetch(
        `https://api.sumup.com/v0.1/checkouts/${
          encodeURIComponent(
            payload.id,
          )
        }`,
        {
          headers: {
            Authorization:
              `Bearer ${sumupKey}`,
          },
        },
      );

    if (
      !verifyResponse.ok
    ) {
      console.error(
        "SUMUP_VERIFY_FAILED",
        verifyResponse.status,
        await verifyResponse.text(),
      );

      throw new Error(
        "Could not verify SumUp checkout.",
      );
    }

    const checkout =
      await verifyResponse.json();

    if (
      checkout.status !==
      "PAID" ||
      checkout.currency !==
      "GBP"
    ) {
      return new Response(
        "",
        { status: 204 },
      );
    }

    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      )!;

    const serviceKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      ) ||
      Deno.env.get(
        "SUPABASE_SECRET_KEY",
      )!;

    const supabase =
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

    // -----------------------------------------------------
    // DEPOSIT PAYMENT
    // -----------------------------------------------------

    const {
      data: depositLead,
    } =
      await supabase
        .from("leads")
        .select("*")
        .eq(
          "sumup_checkout_id",
          checkout.id,
        )
        .maybeSingle();

    if (depositLead) {
      const expectedAmount =
        Number(
          (
            Number(
              depositLead.deposit_amount ||
              0,
            ) /
            100
          ).toFixed(2),
        );

      if (
        Number(
          checkout.amount,
        ) !==
        expectedAmount
      ) {
        return new Response(
          "",
          { status: 204 },
        );
      }

      const paidAt =
        new Date()
          .toISOString();

      const {
        data: paidLead,
        error: updateError,
      } =
        await supabase
          .from("leads")
          .update({
            status:
              "deposit_paid",

            deposit_paid_at:
              paidAt,
          })
          .eq(
            "id",
            depositLead.id,
          )
          .is(
            "deposit_paid_at",
            null,
          )
          .select("*")
          .maybeSingle();

      if (updateError) {
        throw updateError;
      }

      if (!paidLead) {
        return new Response(
          "",
          { status: 204 },
        );
      }

      await sendDepositEmails(
        supabase,
        paidLead,
      );

      return new Response(
        "",
        { status: 204 },
      );
    }


    // -----------------------------------------------------
    // FINAL / BALANCE PAYMENT
    // -----------------------------------------------------

    const {
      data: balanceLead,
    } =
      await supabase
        .from("leads")
        .select("*")
        .eq(
          "balance_sumup_checkout_id",
          checkout.id,
        )
        .maybeSingle();

    if (!balanceLead) {
      return new Response(
        "",
        { status: 204 },
      );
    }

    const expectedBalance =
      Number(
        (
          Number(
            balanceLead.balance_amount ||
            0,
          ) /
          100
        ).toFixed(2),
      );

    if (
      Number(
        checkout.amount,
      ) !==
      expectedBalance
    ) {
      return new Response(
        "",
        { status: 204 },
      );
    }

    const paidAt =
      new Date()
        .toISOString();

    const {
      data: completedLead,
      error: finalUpdateError,
    } =
      await supabase
        .from("leads")
        .update({
          status:
            "completed",

          balance_paid_at:
            paidAt,
        })
        .eq(
          "id",
          balanceLead.id,
        )
        .is(
          "balance_paid_at",
          null,
        )
        .select("*")
        .maybeSingle();

    if (finalUpdateError) {
      throw finalUpdateError;
    }

    if (!completedLead) {
      return new Response(
        "",
        { status: 204 },
      );
    }

    await sendFinalEmails(
      supabase,
      completedLead,
    );

    return new Response(
      "",
      { status: 204 },
    );

  } catch (error) {
    console.error(
      "SUMUP_WEBHOOK_ERROR",
      error instanceof Error
        ? error.message
        : error,
    );

    return new Response(
      "",
      { status: 500 },
    );
  }
});


async function sendDepositEmails(
  db: any,
  lead: any,
) {
  const resendKey =
    Deno.env.get(
      "RESEND_API_KEY",
    );

  const emailFrom =
    Deno.env.get(
      "EMAIL_FROM",
    );

  const adminEmail =
    Deno.env.get(
      "ADMIN_EMAIL",
    );

  const siteUrl =
    (
      Deno.env.get(
        "SITE_URL",
      ) || ""
    ).replace(/\/$/, "");

  if (
    !resendKey ||
    !emailFrom ||
    !adminEmail
  ) {
    return;
  }

  const deposit =
    money(
      lead.deposit_amount,
    );

  const clientHtml = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033;line-height:1.6">
      <h2>Deposit received — your project is confirmed</h2>

      <p>
        Hi ${escapeHtml(lead.name)},
      </p>

      <p>
        Thank you. Your project deposit
        has been received successfully
        through SumUp.
      </p>

      <p>
        <strong>Business:</strong>
        ${escapeHtml(lead.business)}
        <br>

        <strong>Package:</strong>
        ${escapeHtml(lead.package)}
        <br>

        <strong>Deposit received:</strong>
        ${deposit}
      </p>

      <p>
        Your GD Studio 360 project
        is now confirmed.
      </p>

      <p>GD Studio 360</p>
    </div>
  `;

  const adminHtml = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033;line-height:1.6">
      <h2>Deposit received</h2>

      <p>
        <strong>Business:</strong>
        ${escapeHtml(lead.business)}
        <br>

        <strong>Client:</strong>
        ${escapeHtml(lead.name)}
        <br>

        <strong>Deposit:</strong>
        ${deposit}
      </p>

      ${
        siteUrl
          ? `<p><a href="${siteUrl}/admin.html">Open GD Studio 360 Admin</a></p>`
          : ""
      }
    </div>
  `;

  const conversationId =
    await ensureLeadConversation(
      db,
      lead,
    );

  const [
    clientSent,
    adminSent,
  ] =
    await Promise.all([
      sendEmail(
        resendKey,
        {
          from: emailFrom,
          reply_to: [
            `reply+${conversationId}@gdstudio360.co.uk`,
          ],
          to: [
            lead.email,
          ],
          subject:
            "GD Studio 360 — deposit received",
          html:
            clientHtml,
        },
      ),

      sendEmail(
        resendKey,
        {
          from: emailFrom,
          to: [
            adminEmail,
          ],
          subject:
            `Deposit received — ${lead.business} — ${deposit}`,
          html:
            adminHtml,
        },
      ),
    ]);

  if (clientSent) {
    await logClientSystemMessage(
      db,
      conversationId,
      [
        "Deposit payment confirmation email sent to client.",
        "",
        `Deposit received: ${deposit}`,
        `Package: ${lead.package || "Not specified"}`,
      ].join("\n"),
    );
  }

  return {
    clientSent,
    adminSent,
  };
}


async function sendFinalEmails(
  db: any,
  lead: any,
) {
  const resendKey =
    Deno.env.get(
      "RESEND_API_KEY",
    );

  const emailFrom =
    Deno.env.get(
      "EMAIL_FROM",
    );

  const adminEmail =
    Deno.env.get(
      "ADMIN_EMAIL",
    );

  const siteUrl =
    (
      Deno.env.get(
        "SITE_URL",
      ) || ""
    ).replace(/\/$/, "");

  if (
    !resendKey ||
    !emailFrom ||
    !adminEmail
  ) {
    return;
  }

  const total =
    money(
      lead.project_total,
    );

  const balance =
    money(
      lead.balance_amount,
    );

  const clientHtml = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033;line-height:1.6">
      <h2>Final payment received</h2>

      <p>
        Hi ${escapeHtml(lead.name)},
      </p>

      <p>
        Thank you. The remaining project
        balance has been received successfully.
      </p>

      <p>
        <strong>Project total:</strong>
        ${total}
        <br>

        <strong>Final payment:</strong>
        ${balance}
      </p>

      <p>
        Your GD Studio 360 website project
        is now marked as completed.
      </p>

      ${
        lead.live_url
          ? `
            <p>
              <a href="${escapeHtml(lead.live_url)}">
                Open your live website
              </a>
            </p>
          `
          : ""
      }

      <p>
        Thank you for working with
        GD Studio 360.
      </p>
    </div>
  `;

  const adminHtml = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#172033;line-height:1.6">
      <h2>Project paid in full</h2>

      <p>
        <strong>Business:</strong>
        ${escapeHtml(lead.business)}
        <br>

        <strong>Client:</strong>
        ${escapeHtml(lead.name)}
        <br>

        <strong>Final payment:</strong>
        ${balance}
        <br>

        <strong>Total project value:</strong>
        ${total}
      </p>

      ${
        siteUrl
          ? `<p><a href="${siteUrl}/admin.html">Open GD Studio 360 Admin</a></p>`
          : ""
      }
    </div>
  `;

  const conversationId =
    await ensureLeadConversation(
      db,
      lead,
    );

  const [
    clientSent,
    adminSent,
  ] =
    await Promise.all([
      sendEmail(
        resendKey,
        {
          from:
            emailFrom,

          reply_to: [
            `reply+${conversationId}@gdstudio360.co.uk`,
          ],

          to: [
            lead.email,
          ],

          subject:
            "GD Studio 360 — project paid in full",

          html:
            clientHtml,
        },
      ),

      sendEmail(
        resendKey,
        {
          from:
            emailFrom,

          to: [
            adminEmail,
          ],

          subject:
            `Project paid in full — ${lead.business}`,

          html:
            adminHtml,
        },
      ),
    ]);

  if (clientSent) {
    const lines = [
      "Final payment confirmation email sent to client.",
      "",
      `Final payment received: ${balance}`,
      `Project total: ${total}`,
      "Project marked as completed.",
    ];

    if (lead.live_url) {
      lines.push(
        `Live website: ${lead.live_url}`,
      );
    }

    await logClientSystemMessage(
      db,
      conversationId,
      lines.join("\n"),
    );
  }

  return {
    clientSent,
    adminSent,
  };
}


async function sendEmail(
  resendKey: string,
  body: Record<
    string,
    unknown
  >,
) {
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
        body:
          JSON.stringify(
            body,
          ),
      },
    );

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


function money(
  pence: number,
) {
  return `£${
    (
      Number(
        pence ||
        0,
      ) /
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
