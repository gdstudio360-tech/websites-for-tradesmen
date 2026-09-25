const cfg = window.GD_CONFIG || {};
const intro = document.getElementById("payment-intro");
const summary = document.getElementById("payment-summary");
const business = document.getElementById("payment-business");
const packageName = document.getElementById("payment-package");
const amount = document.getElementById("payment-amount");
const termsRow = document.getElementById("payment-terms-row");
const terms = document.getElementById("project-terms-accepted");
const payButton = document.getElementById("pay-button");
const status = document.getElementById("payment-status");

const token = new URLSearchParams(location.search).get("token");
const ready = Boolean(
  token &&
  cfg.SUPABASE_URL &&
  cfg.SUPABASE_PUBLISHABLE_KEY &&
  window.supabase
);

const client = ready
  ? window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_PUBLISHABLE_KEY
    )
  : null;

function formatPence(value) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(Number(value || 0) / 100);
}

async function loadRequest() {
  if (!client) {
    intro.textContent = "This payment page is not connected yet.";
    return;
  }

  const { data, error } = await client.functions.invoke("payment-request-info", {
    body: { token }
  });

  if (error || !data?.ok) {
    intro.textContent = data?.error || error?.message || "Payment request not found.";
    return;
  }

  if (data.status === "deposit_paid") {
    intro.textContent = "This project deposit has already been paid.";
    status.textContent = "No further payment is required.";
    return;
  }

  if (!["approved", "deposit_sent"].includes(data.status)) {
    intro.textContent = "This payment request is not currently active.";
    return;
  }

  intro.textContent =
    "Please check the details below. When you continue, a fresh secure SumUp checkout will be created.";

  business.textContent = data.business;
  packageName.textContent = data.package;
  amount.textContent = formatPence(data.deposit_amount);

  summary.hidden = false;
  termsRow.hidden = false;

  terms.addEventListener("change", () => {
    payButton.disabled = !terms.checked;
  });
}

payButton.addEventListener("click", async () => {
  if (!client || !terms.checked) return;

  payButton.disabled = true;
  payButton.textContent = "Opening SumUp…";
  status.textContent = "Creating a fresh secure checkout…";

  const { data, error } = await client.functions.invoke("create-sumup-checkout", {
    body: { token }
  });

  if (error || !data?.ok) {
    status.textContent =
      data?.already_paid
        ? "This deposit has already been paid."
        : (data?.error || error?.message || "Could not create payment.");
    payButton.disabled = false;
    payButton.textContent = "Continue to SumUp →";
    return;
  }

  window.location.href = data.checkout_url;
});

loadRequest();
