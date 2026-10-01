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

let leadsSnapshot = "";
let leadRefreshBusy = false;

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

function cleanCustomerReply(value) {
  const text =
    String(value || "")
      .replace(/\r\n/g, "\n")
      .trim();

  if (!text) return "";

  const lines = text.split("\n");
  let cutAt = lines.length;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();

    const normalised =
      line
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();

    const isQuotedStart =
      line.startsWith(">") ||
      normalised.endsWith("rase:") ||
      normalised.endsWith("wrote:") ||
      /^on .+ wrote:$/i.test(line) ||
      /<[^<>@\s]+@[^<>@\s]+>.*:$/.test(line) ||
      /^(from|nuo|sent|issiusta|subject|tema):\s+/i.test(normalised) ||
      /^[-_]{2,}\s*original message\s*[-_]{2,}$/i.test(normalised);

    if (isQuotedStart) {
      cutAt = i;
      break;
    }
  }

  return lines
    .slice(0, cutAt)
    .join("\n")
    .trim();
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

async function loadLeads(options = {}) {
  if (!client) return;

  const background =
    options.background === true;

  if (!background) {
    dashboardStatus.textContent =
      "Loading enquiries…";
  }

  const { data, error } = await client
    .from("leads")
    .select("*")
    .order(
      "created_at",
      { ascending: false }
    );

  if (error) {
    if (!background) {
      dashboardStatus.textContent =
        error.message;
    }

    return;
  }

  const nextLeads = data || [];

  const nextSnapshot =
    JSON.stringify(nextLeads);

  const changed =
    nextSnapshot !== leadsSnapshot;

  leads = nextLeads;
  leadsSnapshot = nextSnapshot;

  dashboardStatus.textContent =
    `${leads.length} enquiries • Live`;

  if (
    changed ||
    !background
  ) {
    renderLeads();
  }
}


function adminIsBusy() {
  const openConversation =
    document.querySelector(
      ".admin-conversation:not([hidden])"
    );

  if (openConversation) {
    return true;
  }

  const active =
    document.activeElement;

  if (!active) {
    return false;
  }

  return Boolean(
    active.matches?.(
      ".admin-reply-text, " +
      ".admin-package-select, " +
      ".admin-care-select"
    )
  );
}


setInterval(async () => {
  if (
    !client ||
    document.hidden ||
    dashboardView.hidden ||
    leadRefreshBusy ||
    adminIsBusy()
  ) {
    return;
  }

  leadRefreshBusy = true;

  try {
    await loadLeads({
      background: true
    });
  } catch (error) {
    console.error(
      "Lead auto-refresh failed:",
      error
    );
  } finally {
    leadRefreshBusy = false;
  }
}, 5000);


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
      lead.care_plan,
      lead.attribution_source,
      lead.attribution_campaign
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

    if (card && lead.id) {
      card.dataset.leadId =
        String(lead.id);
    }

    fragment.querySelector(".lead-status").textContent = prettyStatus(lead.status);
    fragment.querySelector(".lead-business").textContent = lead.business || "Unnamed business";
    fragment.querySelector(".lead-person").textContent = `${lead.name || ""} • ${lead.trade || "Business type not supplied"}`;
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

    if (
      lead.attribution_source ||
      lead.attribution_campaign
    ) {
      const attribution =
        document.createElement("span");

      attribution.textContent =
        `Source: ${
          lead.attribution_source ||
          "Direct / unknown"
        }${
          lead.attribution_campaign
            ? ` • Campaign: ${lead.attribution_campaign}`
            : ""
        }`;

      meta.appendChild(attribution);
    }

    fragment.querySelector(".lead-message").textContent =
      lead.message || "No additional message.";

    const approve = fragment.querySelector(".approve-button");
    const reject = fragment.querySelector(".reject-button");
    const copyLink = fragment.querySelector(".copy-link-button");
    const openLink = fragment.querySelector(".open-link-button");
    const building = fragment.querySelector(".building-button");
    const complete = fragment.querySelector(".complete-button");
    const result = fragment.querySelector(".deposit-result");
    const actions = fragment.querySelector(".lead-actions");

    const conversationButton =
      document.createElement("button");

    conversationButton.type = "button";
    conversationButton.className =
      "secondary-button conversation-button";

    conversationButton.textContent =
      lead.conversation_id
        ? "Open conversation"
        : "Reply";

    actions.prepend(conversationButton);

    const conversationPanel =
      document.createElement("section");

    conversationPanel.className =
      "admin-conversation";

    conversationPanel.hidden = true;

    conversationPanel.innerHTML = `
      <div class="admin-conversation-head">
        <div>
          <strong>Conversation</strong>
          <small>
            Replies are sent by GD Studio 360 via email.
          </small>
        </div>
        <button
          type="button"
          class="conversation-close"
          aria-label="Close conversation"
        >×</button>
      </div>

      <div class="conversation-history"></div>

      <form class="admin-reply-form">
        <label>
          Reply
          <textarea
            class="admin-reply-text"
            rows="4"
            maxlength="5000"
            placeholder="Write your reply..."
            required
          ></textarea>
        </label>

        <div class="admin-reply-actions">
          <button
            type="submit"
            class="approve-button admin-send-reply"
          >
            Send reply
          </button>

          <span class="admin-reply-status"></span>
        </div>
      </form>
    `;

    fragment
      .querySelector(".lead-message")
      .after(conversationPanel);

    const conversationHistory =
      conversationPanel.querySelector(
        ".conversation-history"
      );

    const replyForm =
      conversationPanel.querySelector(
        ".admin-reply-form"
      );

    const replyText =
      conversationPanel.querySelector(
        ".admin-reply-text"
      );

    const replyStatus =
      conversationPanel.querySelector(
        ".admin-reply-status"
      );

    const sendReplyButton =
      conversationPanel.querySelector(
        ".admin-send-reply"
      );

    const closeConversation =
      conversationPanel.querySelector(
        ".conversation-close"
      );

    const renderedMessageIds = new Set();
    let conversationRequestBusy = false;
    let conversationInitialised = false;

    function appendConversationMessage(message) {
      const bubble =
        document.createElement("div");

      bubble.className =
        `conversation-message role-${message.role}`;

      const top =
        document.createElement("div");

      top.className =
        "conversation-message-meta";

      const role =
        document.createElement("strong");

      const names = {
        customer: "Customer",
        assistant: "AI Assistant",
        human: "You",
        system: "System"
      };

      role.textContent =
        names[message.role] ||
        message.role;

      const time =
        document.createElement("span");

      time.textContent =
        message.created_at
          ? new Date(
              message.created_at
            ).toLocaleString("en-GB")
          : "";

      top.append(role, time);

      const content =
        document.createElement("p");

      const rawContent =
        message.content || "";

      content.textContent =
        message.role === "customer"
          ? cleanCustomerReply(rawContent)
          : rawContent;

      const channel =
        document.createElement("small");

      channel.textContent =
        message.channel || "";

      bubble.append(
        top,
        content,
        channel
      );

      conversationHistory.appendChild(
        bubble
      );

      if (message.id) {
        renderedMessageIds.add(
          String(message.id)
        );
      }
    }

    async function loadConversation() {
      if (conversationRequestBusy) {
        return;
      }

      conversationRequestBusy = true;

      const wasNearBottom =
        !conversationInitialised ||
        (
          conversationHistory.scrollHeight -
          conversationHistory.scrollTop -
          conversationHistory.clientHeight
        ) < 80;

      try {
        const { data, error } =
          await client.functions.invoke(
            "admin-inbox",
            {
              body: {
                action: "history",
                lead_id: lead.id
              }
            }
          );

        if (error || !data?.ok) {
          if (!conversationInitialised) {
            conversationHistory.textContent =
              data?.error ||
              error?.message ||
              "Could not load conversation.";
          }
          return;
        }

        if (data.conversation_id) {
          lead.conversation_id =
            data.conversation_id;

          conversationButton.textContent =
            "Open conversation";
        }

        const items =
          Array.isArray(data.messages)
            ? data.messages
            : [];

        if (!conversationInitialised) {
          conversationHistory.innerHTML = "";
          renderedMessageIds.clear();

          if (!items.length) {
            const empty =
              document.createElement("p");

            empty.className =
              "conversation-empty";

            empty.textContent =
              "No conversation history yet. Write a reply below to start one.";

            conversationHistory.appendChild(
              empty
            );
          } else {
            for (const message of items) {
              appendConversationMessage(
                message
              );
            }
          }

          conversationInitialised = true;

          conversationHistory.scrollTop =
            conversationHistory.scrollHeight;

          return;
        }

        const newItems =
          items.filter(
            (message) =>
              !renderedMessageIds.has(
                String(message.id)
              )
          );

        if (!newItems.length) {
          return;
        }

        conversationHistory
          .querySelector(
            ".conversation-empty"
          )
          ?.remove();

        for (const message of newItems) {
          appendConversationMessage(
            message
          );
        }

        if (wasNearBottom) {
          conversationHistory.scrollTop =
            conversationHistory.scrollHeight;
        }

      } finally {
        conversationRequestBusy = false;
      }
    }

    let conversationRefreshBusy = false;

setInterval(async () => {
  if (
    conversationPanel.hidden ||
    conversationRefreshBusy
  ) {
    return;
  }

  conversationRefreshBusy = true;

  try {
    await loadConversation();
  } catch (error) {
    console.error(
      "Conversation auto-refresh failed:",
      error
    );
  } finally {
    conversationRefreshBusy = false;
  }
}, 3000);

conversationButton.addEventListener(
      "click",
      async () => {
        conversationPanel.hidden = false;
        conversationButton.hidden = true;
        await loadConversation();
        replyText.focus();
      }
    );

    closeConversation.addEventListener(
      "click",
      () => {
        conversationPanel.hidden = true;
        conversationButton.hidden = false;
      }
    );

    replyForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const message =
          replyText.value.trim();

        if (!message) {
          replyStatus.textContent =
            "Write a reply first.";
          return;
        }

        sendReplyButton.disabled = true;
        sendReplyButton.textContent =
          "Sending…";

        replyStatus.textContent =
          `Sending to ${lead.email || "customer"}…`;

        const { data, error } =
          await client.functions.invoke(
            "admin-inbox",
            {
              body: {
                action: "send",
                lead_id: lead.id,
                message
              }
            }
          );

        if (error || !data?.ok) {
          replyStatus.textContent =
            data?.error ||
            error?.message ||
            "Could not send reply.";

          sendReplyButton.disabled = false;
          sendReplyButton.textContent =
            "Send reply";

          return;
        }

        if (data.conversation_id) {
          lead.conversation_id =
            data.conversation_id;
        }

        replyText.value = "";
        replyStatus.textContent =
          "Reply sent.";

        sendReplyButton.disabled = false;
        sendReplyButton.textContent =
          "Send reply";

        await loadConversation();
      }
    );

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
