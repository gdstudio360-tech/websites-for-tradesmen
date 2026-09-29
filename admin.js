const config = window.GD_CONFIG || {};
const configured = Boolean(config.SUPABASE_URL && config.SUPABASE_PUBLISHABLE_KEY);

const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const dashboardStatus = document.getElementById("dashboard-status");
const logoutButton = document.getElementById("logout-button");
const refreshButton = document.getElementById("refresh-button");
const statusFilter = document.getElementById("status-filter");
const searchInput = document.getElementById("search-input");
const leadList = document.getElementById("lead-list");
const leadTemplate = document.getElementById("lead-template");

let client = null;
let leads = [];

if (configured && window.supabase) {
  client = window.supabase.createClient(
    config.SUPABASE_URL,
    config.SUPABASE_PUBLISHABLE_KEY
  );
} else {
  loginStatus.textContent =
    "Supabase is not connected yet. Add SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY to site-config.js.";
}

function moneyFromPence(value) {
  if (value == null) return "";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP"
  }).format(value / 100);
}

function prettyStatus(status) {
  return String(status || "new").replaceAll("_", " ");
}

const ADMIN_PACKAGES = [
  "Not sure — recommend one",
  "Starter — £249",
  "Business — £399",
  "Pro — £599"
];

const ADMIN_CARE_BY_PACKAGE = {
  "Starter — £249": "Website Care — £29/month",
  "Business — £399": "Business Care — £59/month",
  "Pro — £599": "Pro Care — £99/month"
};

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
  logoutButton.hidden = true;
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  logoutButton.hidden = false;
}

async function ensureSession() {
  if (!client) return showLogin();
  const { data } = await client.auth.getSession();
  if (data.session) {
    showDashboard();
    await loadLeads();
  } else {
    showLogin();
  }
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!client) return;

  loginStatus.textContent = "Signing in…";
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    loginStatus.textContent = error.message;
    return;
  }

  loginStatus.textContent = "";
  showDashboard();
  await loadLeads();
});

logoutButton?.addEventListener("click", async () => {
  if (client) await client.auth.signOut();
  leads = [];
  renderLeads();
  showLogin();
});

refreshButton?.addEventListener("click", loadLeads);
statusFilter?.addEventListener("change", renderLeads);
searchInput?.addEventListener("input", renderLeads);

async function loadLeads() {
  if (!client) return;
  dashboardStatus.textContent = "Loading enquiries…";

  const { data, error } = await client
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    dashboardStatus.textContent = error.message;
    return;
  }

  leads = data || [];
  dashboardStatus.textContent = `${leads.length} enquiries`;
  renderLeads();
}

function renderStats() {
  const count = (status) => leads.filter((lead) => lead.status === status).length;
  document.getElementById("stat-new").textContent = count("new");
  document.getElementById("stat-sent").textContent = count("deposit_sent");
  document.getElementById("stat-paid").textContent = count("deposit_paid");
  document.getElementById("stat-building").textContent = count("building");
}

function renderLeads() {
  renderStats();
  if (!leadList || !leadTemplate) return;

  const filter = statusFilter?.value || "all";
  const query = (searchInput?.value || "").trim().toLowerCase();

  const visible = leads.filter((lead) => {
    const matchesStatus = filter === "all" || lead.status === filter;
    const haystack = [
      lead.business,
      lead.name,
      lead.email,
      lead.phone,
      lead.trade,
      lead.area,
      lead.package,
      lead.care_plan
    ].join(" ").toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    return matchesStatus && matchesSearch;
  });

  leadList.innerHTML = "";

  if (!visible.length) {
    leadList.innerHTML = "<p>No enquiries match this filter.</p>";
    return;
  }

  for (const lead of visible) {
    const fragment = leadTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".lead-card");

    fragment.querySelector(".lead-status").textContent = prettyStatus(lead.status);
    fragment.querySelector(".lead-business").textContent = lead.business || "Unnamed business";
    fragment.querySelector(".lead-person").textContent = `${lead.name || ""} • ${lead.trade || "Trade not supplied"}`;
    fragment.querySelector(".lead-package").textContent =
      `${lead.package || "Package not selected"} • Care: ${lead.care_plan || "No care plan"}`;

    const meta = fragment.querySelector(".lead-meta");
    const parts = [
      lead.email ? `<a href="mailto:${encodeURIComponent(lead.email)}">${lead.email}</a>` : "",
      lead.phone ? `<a href="tel:${lead.phone.replace(/[^\d+]/g, "")}">${lead.phone}</a>` : "",
      lead.area || "",
      lead.current_site ? `<a href="${lead.current_site}" target="_blank" rel="noopener">Current site ↗</a>` : "",
      lead.created_at ? new Date(lead.created_at).toLocaleString("en-GB") : ""
    ].filter(Boolean);
    meta.innerHTML = parts.map((item) => `<span>${item}</span>`).join("");

    fragment.querySelector(".lead-message").textContent =
      lead.message || "No additional message.";

    const approve = fragment.querySelector(".approve-button");
    const reject = fragment.querySelector(".reject-button");
    const copyLink = fragment.querySelector(".copy-link-button");
    const openLink = fragment.querySelector(".open-link-button");
    const building = fragment.querySelector(".building-button");
    const complete = fragment.querySelector(".complete-button");
    const result = fragment.querySelector(".deposit-result");

    let packageEditor = null;
    let careEditor = null;

    if (["new", "approved"].includes(lead.status)) {
      const editor = document.createElement("div");
      editor.className = "lead-decision";
      editor.innerHTML = `
        <label>
          Package
          <select class="admin-package-select">
            ${ADMIN_PACKAGES.map((item) =>
              `<option value="${item}">${item}</option>`
            ).join("")}
          </select>
        </label>

        <label>
          Care plan
          <select class="admin-care-select"></select>
        </label>
      `;

      fragment.querySelector(".lead-actions").before(editor);

      packageEditor = editor.querySelector(".admin-package-select");
      careEditor = editor.querySelector(".admin-care-select");

      packageEditor.value = ADMIN_PACKAGES.includes(lead.package)
        ? lead.package
        : "Not sure — recommend one";

      const refreshAdminCare = () => {
        const current = careEditor.value || lead.care_plan || "No care plan";
        const matchingCare = ADMIN_CARE_BY_PACKAGE[packageEditor.value];

        careEditor.innerHTML = "";

        const noCare = document.createElement("option");
        noCare.value = "No care plan";
        noCare.textContent = "No care plan";
        careEditor.appendChild(noCare);

        if (matchingCare) {
          const option = document.createElement("option");
          option.value = matchingCare;
          option.textContent = matchingCare;
          careEditor.appendChild(option);
        }

        careEditor.value =
          Array.from(careEditor.options).some((option) => option.value === current)
            ? current
            : "No care plan";
      };

      refreshAdminCare();
      packageEditor.addEventListener("change", refreshAdminCare);
    }

    const hasDepositLink = Boolean(lead.deposit_url);
    const canApprove = ["new", "approved"].includes(lead.status);

    approve.hidden = !canApprove;
    reject.hidden = !["new", "approved"].includes(lead.status);

    if (hasDepositLink) {
      copyLink.hidden = false;
      openLink.hidden = false;
      openLink.href = lead.deposit_url;
    }

    building.hidden = lead.status !== "deposit_paid";
    complete.hidden = !["building", "review", "balance_due"].includes(lead.status);

    if (lead.deposit_amount) {
      result.hidden = false;
      result.textContent =
        `${moneyFromPence(lead.deposit_amount)} deposit • ${prettyStatus(lead.status)}` +
        (lead.approval_email_sent_at ? " • approval email sent" : "");
    }

    approve.addEventListener("click", async () => {
      const selectedPackage = packageEditor?.value || lead.package;
      const selectedCare = careEditor?.value || lead.care_plan || "No care plan";

      if (selectedPackage === "Not sure — recommend one") {
        dashboardStatus.textContent =
          "Choose Starter, Business or Pro before approving this project.";
        packageEditor?.focus();
        return;
      }

      approve.disabled = true;
      approve.textContent = "Approving…";
      dashboardStatus.textContent = `Approving ${lead.business}…`;

      const { error: selectionError } = await client
        .from("leads")
        .update({
          package: selectedPackage,
          care_plan: selectedCare
        })
        .eq("id", lead.id);

      if (selectionError) {
        dashboardStatus.textContent = selectionError.message;
        approve.disabled = false;
        approve.textContent = "Approve & create deposit";
        return;
      }

      const { data, error } = await client.functions.invoke("approve-lead", {
        body: { lead_id: lead.id }
      });

      if (error || !data?.ok) {
        dashboardStatus.textContent =
          data?.error || error?.message || "Could not approve this lead.";
        approve.disabled = false;
        approve.textContent = "Approve project";
        return;
      }

      dashboardStatus.textContent = data.email_sent
        ? "Approved. Payment page created and approval email sent."
        : "Approved. Payment page created. Copy the payment link and send it manually.";

      await loadLeads();
    });

    copyLink.addEventListener("click", async () => {
      await navigator.clipboard.writeText(lead.deposit_url);

      if (lead.status === "approved") {
        await client
          .from("leads")
          .update({ status: "deposit_sent" })
          .eq("id", lead.id);
      }

      copyLink.textContent = "Copied";
      setTimeout(() => (copyLink.textContent = "Copy deposit link"), 1500);
    });

    reject.addEventListener("click", async () => {
      if (!confirm(`Reject ${lead.business}?`)) return;
      await updateStatus(lead.id, "rejected");
    });

    building.addEventListener("click", () => updateStatus(lead.id, "building"));
    complete.addEventListener("click", () => updateStatus(lead.id, "completed"));

    leadList.appendChild(fragment);
  }
}

async function updateStatus(id, status) {
  if (!client) return;
  const { error } = await client
    .from("leads")
    .update({ status })
    .eq("id", id);

  if (error) {
    dashboardStatus.textContent = error.message;
    return;
  }

  await loadLeads();
}

ensureSession();
