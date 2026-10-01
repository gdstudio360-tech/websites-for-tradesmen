const cfg =
  window.GD_CONFIG || {};

const intro =
  document.getElementById(
    "payment-intro"
  );

const summary =
  document.getElementById(
    "payment-summary"
  );

const business =
  document.getElementById(
    "payment-business"
  );

const packageName =
  document.getElementById(
    "payment-package"
  );

const total =
  document.getElementById(
    "payment-total"
  );

const deposit =
  document.getElementById(
    "payment-deposit"
  );

const balance =
  document.getElementById(
    "payment-balance"
  );

const payButton =
  document.getElementById(
    "pay-button"
  );

const status =
  document.getElementById(
    "payment-status"
  );

const token =
  new URLSearchParams(
    location.search
  ).get("token");

const ready =
  Boolean(
    token &&
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_PUBLISHABLE_KEY &&
    window.supabase
  );

const client =
  ready
    ? window.supabase
        .createClient(
          cfg.SUPABASE_URL,
          cfg.SUPABASE_PUBLISHABLE_KEY,
        )
    : null;


function formatPence(
  value,
) {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP",
    },
  ).format(
    Number(
      value || 0,
    ) / 100,
  );
}


async function loadRequest() {
  if (!client) {
    intro.textContent =
      "This payment page is not connected.";

    return;
  }

  const {
    data,
    error,
  } =
    await client
      .functions
      .invoke(
        "balance-payment-info",
        {
          body: {
            token,
          },
        },
      );

  if (
    error ||
    !data?.ok
  ) {
    intro.textContent =
      data?.error ||
      error?.message ||
      "Payment request not found.";

    return;
  }

  if (
    data.balance_paid_at ||
    data.status ===
      "completed"
  ) {
    intro.textContent =
      "This project has already been paid in full.";

    status.textContent =
      "No further payment is required.";

    return;
  }

  if (
    data.status !==
    "balance_due"
  ) {
    intro.textContent =
      "This final payment request is not currently active.";

    return;
  }

  intro.textContent =
    "Please check the project payment details below. A secure SumUp checkout will open when you continue.";

  business.textContent =
    data.business || "";

  packageName.textContent =
    data.package || "";

  total.textContent =
    formatPence(
      data.project_total,
    );

  deposit.textContent =
    formatPence(
      data.deposit_amount,
    );

  balance.textContent =
    formatPence(
      data.balance_amount,
    );

  summary.hidden =
    false;

  payButton.disabled =
    false;
}


payButton.addEventListener(
  "click",
  async () => {
    if (!client) {
      return;
    }

    payButton.disabled =
      true;

    payButton.textContent =
      "Opening SumUp…";

    status.textContent =
      "Creating a fresh secure checkout…";

    const {
      data,
      error,
    } =
      await client
        .functions
        .invoke(
          "create-balance-checkout",
          {
            body: {
              token,
            },
          },
        );

    if (
      error ||
      !data?.ok
    ) {
      status.textContent =
        data?.already_paid
          ? "This project has already been paid in full."
          : (
              data?.error ||
              error?.message ||
              "Could not create payment."
            );

      payButton.disabled =
        false;

      payButton.textContent =
        "Pay remaining balance →";

      return;
    }

    window.location.href =
      data.checkout_url;
  },
);


loadRequest();
