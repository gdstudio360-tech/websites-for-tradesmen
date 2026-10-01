const config =
  window.GD_CONFIG || {};

const loginView =
  document.getElementById("login-view");

const dashboardView =
  document.getElementById("dashboard-view");

const loginForm =
  document.getElementById("login-form");

const loginStatus =
  document.getElementById("login-status");

const logoutButton =
  document.getElementById("logout-button");

const paymentMode =
  document.getElementById("payment-mode");

const clientsScreen =
  document.getElementById("clients-screen");

const detailScreen =
  document.getElementById("detail-screen");

const clientList =
  document.getElementById("client-list");

const dashboardStatus =
  document.getElementById("dashboard-status");

const searchInput =
  document.getElementById("search-input");

const backButton =
  document.getElementById("back-button");

const detailContent =
  document.getElementById("detail-content");

const detailBusiness =
  document.getElementById("detail-business");

const detailPerson =
  document.getElementById("detail-person");

const detailStatus =
  document.getElementById("detail-status");

const clientAvatar =
  document.getElementById("client-avatar");

const IN_PROGRESS_STATUSES = [
  "approved",
  "deposit_sent",
  "deposit_paid",
  "building",
  "review",
  "balance_due"
];

const PACKAGE_TOTALS = {
  "Starter — £249": 24900,
  "Business — £399": 39900,
  "Pro — £599": 59900
};

let supabaseClient = null;
let leads = [];
let activeView = "new";
let activeDetailTab = "overview";
let selectedLeadId = null;
let realtimeChannel = null;

let conversationTimer = null;
let conversationLeadId = null;
let conversationMessageIds = new Set();


if (
  config.SUPABASE_URL &&
  config.SUPABASE_PUBLISHABLE_KEY &&
  window.supabase
) {
  supabaseClient =
    window.supabase.createClient(
      config.SUPABASE_URL,
      config.SUPABASE_PUBLISHABLE_KEY
    );
} else {
  loginStatus.textContent =
    "Supabase configuration missing.";
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function prettyStatus(value) {
  return String(value || "new")
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      char => char.toUpperCase()
    );
}


function categoryForLead(lead) {
  if (lead.status === "new") {
    return "new";
  }

  if (
    IN_PROGRESS_STATUSES.includes(
      lead.status
    )
  ) {
    return "progress";
  }

  if (lead.status === "completed") {
    return "completed";
  }

  if (lead.status === "rejected") {
    return "rejected";
  }

  return "progress";
}


function money(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "GBP"
    }
  ).format(
    Number(value) / 100
  );
}


function normaliseUrl(value) {
  const raw =
    String(value || "").trim();

  if (!raw) {
    return "";
  }

  let candidate = raw;

  if (
    !/^https?:\/\//i.test(candidate)
  ) {
    candidate =
      `https://${candidate}`;
  }

  try {
    const url =
      new URL(candidate);

    if (
      !["http:", "https:"]
        .includes(url.protocol)
    ) {
      return "";
    }

    return url.toString();

  } catch {
    return "";
  }
}



function cleanCustomerReply(value) {
  const text =
    String(value || "")
      .replace(/\r\n/g, "\n")
      .trim();

  if (!text) {
    return "";
  }

  const lines = text.split("\n");
  let cutAt = lines.length;

  for (
    let i = 1;
    i < lines.length;
    i += 1
  ) {
    const line =
      lines[i].trim();

    const normalised =
      line
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();

    const quoted =
      line.startsWith(">") ||
      normalised.endsWith("rase:") ||
      normalised.endsWith("wrote:") ||
      /^on .+ wrote:$/i.test(line) ||
      /^(from|nuo|sent|issiusta|subject|tema):\s+/i
        .test(normalised);

    if (quoted) {
      cutAt = i;
      break;
    }
  }

  return lines
    .slice(0, cutAt)
    .join("\n")
    .trim();
}


function stopConversationPolling() {
  if (conversationTimer) {
    clearInterval(conversationTimer);
    conversationTimer = null;
  }

  conversationLeadId = null;
  conversationMessageIds =
    new Set();
}


function appendConversationMessage(message) {
  const history =
    document.getElementById(
      "mobile-conversation-history"
    );

  if (!history) {
    return;
  }

  history
    .querySelector(
      ".conversation-empty"
    )
    ?.remove();

  const bubble =
    document.createElement("div");

  const role =
    message.role || "customer";

  bubble.className =
    `mobile-message role-${role}`;

  const labels = {
    customer: "Customer",
    assistant: "AI Assistant",
    human: "You",
    system: "System"
  };

  const content =
    role === "customer"
      ? cleanCustomerReply(
          message.content
        )
      : String(
          message.content || ""
        );

  bubble.innerHTML = `
    <div class="mobile-message-meta">

      <strong>
        ${
          escapeHtml(
            labels[role] || role
          )
        }
      </strong>

      <span>
        ${
          message.created_at
            ? escapeHtml(
                new Date(
                  message.created_at
                ).toLocaleString(
                  "en-GB"
                )
              )
            : ""
        }
      </span>

    </div>

    <div class="mobile-message-text">
      ${escapeHtml(content)}
    </div>

    ${
      message.channel
        ? `
          <small>
            ${escapeHtml(message.channel)}
          </small>
        `
        : ""
    }
  `;

  history.appendChild(bubble);

  if (message.id) {
    conversationMessageIds.add(
      String(message.id)
    );
  }
}


async function loadConversation(lead) {
  if (
    !lead ||
    activeDetailTab !== "chat" ||
    String(selectedLeadId) !==
      String(lead.id)
  ) {
    return;
  }

  const history =
    document.getElementById(
      "mobile-conversation-history"
    );

  if (!history) {
    return;
  }

  const {
    data,
    error
  } =
    await supabaseClient.functions.invoke(
      "admin-inbox",
      {
        body: {
          action: "history",
          lead_id: lead.id
        }
      }
    );

  if (
    error ||
    !data?.ok
  ) {
    history.innerHTML = `
      <p class="conversation-empty">
        ${
          escapeHtml(
            data?.error ||
            error?.message ||
            "Could not load conversation."
          )
        }
      </p>
    `;

    return;
  }

  const items =
    Array.isArray(data.messages)
      ? data.messages
      : [];

  if (
    String(conversationLeadId) !==
    String(lead.id)
  ) {
    conversationLeadId =
      lead.id;

    conversationMessageIds =
      new Set();

    history.innerHTML = "";
  }

  if (
    !items.length &&
    !history.children.length
  ) {
    history.innerHTML = `
      <p class="conversation-empty">
        No conversation history yet.
      </p>
    `;

    return;
  }

  const nearBottom =
    (
      history.scrollHeight -
      history.scrollTop -
      history.clientHeight
    ) < 100;

  const newItems =
    items.filter(
      message =>
        !conversationMessageIds.has(
          String(message.id)
        )
    );

  for (const message of newItems) {
    appendConversationMessage(
      message
    );
  }

  if (
    nearBottom ||
    newItems.length === items.length
  ) {
    history.scrollTop =
      history.scrollHeight;
  }
}


function startConversationPolling(lead) {
  stopConversationPolling();

  conversationLeadId =
    lead.id;

  conversationMessageIds =
    new Set();

  loadConversation(lead);

  const form =
    document.getElementById(
      "mobile-reply-form"
    );

  const textarea =
    document.getElementById(
      "mobile-reply-text"
    );

  const sendButton =
    document.getElementById(
      "mobile-send-reply"
    );

  const status =
    document.getElementById(
      "mobile-reply-status"
    );

  form?.addEventListener(
    "submit",
    async event => {
      event.preventDefault();

      const message =
        textarea.value.trim();

      if (!message) {
        return;
      }

      sendButton.disabled = true;
      sendButton.textContent =
        "Sending…";

      status.textContent =
        "Sending…";

      const {
        data,
        error
      } =
        await supabaseClient.functions.invoke(
          "admin-inbox",
          {
            body: {
              action: "send",
              lead_id: lead.id,
              message
            }
          }
        );

      if (
        error ||
        !data?.ok
      ) {
        status.textContent =
          data?.error ||
          error?.message ||
          "Could not send reply.";

        sendButton.disabled = false;
        sendButton.textContent =
          "Send";

        return;
      }

      textarea.value = "";

      status.textContent =
        "Sent";

      sendButton.disabled = false;
      sendButton.textContent =
        "Send";

      await loadConversation(
        lead
      );

      setTimeout(
        () => {
          if (status) {
            status.textContent = "";
          }
        },
        1800
      );
    }
  );

  conversationTimer =
    setInterval(
      () => {
        if (
          !document.hidden &&
          activeDetailTab === "chat" &&
          String(selectedLeadId) ===
            String(lead.id)
        ) {
          loadConversation(lead);
        }
      },
      3000
    );
}



function getSelectedLead() {
  return leads.find(
    lead =>
      String(lead.id) ===
      String(selectedLeadId)
  );
}


function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
}


function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
}


function showClients() {
  stopConversationPolling();

  selectedLeadId = null;
  detailScreen.hidden = true;
  clientsScreen.hidden = false;
}


function showDetail(leadId) {
  stopConversationPolling();

  selectedLeadId = leadId;
  activeDetailTab = "overview";

  clientsScreen.hidden = true;
  detailScreen.hidden = false;

  updateDetailTabs();
  renderDetail();

  window.scrollTo({
    top: 0,
    behavior: "instant"
  });
}


async function loadPaymentMode() {
  if (!supabaseClient) {
    return;
  }

  paymentMode.textContent = "…";
  paymentMode.className = "mode-badge";

  const {
    data,
    error
  } =
    await supabaseClient.functions.invoke(
      "admin-system-status",
      {
        body: {}
      }
    );

  if (
    error ||
    !data?.ok
  ) {
    paymentMode.textContent =
      "MODE ?";
    return;
  }

  const test =
    data.sumup_test_mode === true;

  paymentMode.textContent =
    test
      ? "SUMUP TEST"
      : "SUMUP LIVE";

  paymentMode.className =
    `mode-badge ${
      test ? "test" : "live"
    }`;
}


function filteredLeads() {
  const query =
    String(
      searchInput.value || ""
    )
      .trim()
      .toLowerCase();

  return leads.filter(
    lead => {
      const category =
        categoryForLead(lead);

      if (
        !query &&
        activeView !== "all" &&
        category !== activeView
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        lead.business,
        lead.name,
        lead.email,
        lead.phone,
        lead.trade,
        lead.area,
        lead.package,
        lead.status
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    }
  );
}


function renderCounts() {
  const counts = {
    new: 0,
    progress: 0,
    completed: 0,
    rejected: 0,
    all: leads.length
  };

  for (const lead of leads) {
    const category =
      categoryForLead(lead);

    if (
      counts[category] !==
      undefined
    ) {
      counts[category] += 1;
    }
  }

  document.getElementById(
    "count-new"
  ).textContent = counts.new;

  document.getElementById(
    "count-progress"
  ).textContent = counts.progress;

  document.getElementById(
    "count-completed"
  ).textContent =
    counts.completed;

  document.getElementById(
    "count-rejected"
  ).textContent =
    counts.rejected;

  document.getElementById(
    "count-all"
  ).textContent =
    counts.all;

  document.getElementById(
    "total-count"
  ).textContent =
    counts.all;
}


function renderClientList() {
  const rows =
    filteredLeads();

  clientList.innerHTML = "";

  if (!rows.length) {
    clientList.innerHTML = `
      <div class="empty-state">
        No clients in this list.
      </div>
    `;

    return;
  }

  for (const lead of rows) {
    const card =
      document.createElement(
        "button"
      );

    card.type = "button";
    card.className = "client-card";

    const date =
      lead.created_at
        ? new Date(
            lead.created_at
          ).toLocaleDateString(
            "en-GB",
            {
              day: "2-digit",
              month: "short"
            }
          )
        : "";

    const category =
      categoryForLead(lead);

    card.innerHTML = `
      <div class="client-card-top">

        <div>
          <h3>
            ${
              escapeHtml(
                lead.business ||
                "Unnamed business"
              )
            }
          </h3>

          <div class="client-name">
            ${
              escapeHtml(
                lead.name || ""
              )
            }
          </div>
        </div>

        <span
          class="status-badge status-${category}"
        >
          ${
            escapeHtml(
              prettyStatus(
                lead.status
              )
            )
          }
        </span>

      </div>

      <div class="client-meta">

        <span>
          ${
            escapeHtml(
              lead.package ||
              "No package"
            )
          }
        </span>

        <span>
          ${date}
        </span>

      </div>
    `;

    card.addEventListener(
      "click",
      () => showDetail(lead.id)
    );

    clientList.appendChild(card);
  }
}


async function loadLeads({
  background = false
} = {}) {
  if (!supabaseClient) {
    return;
  }

  if (!background) {
    dashboardStatus.textContent =
      "Loading clients…";
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from("leads")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) {
    dashboardStatus.textContent =
      error.message;
    return;
  }

  leads = data || [];

  renderCounts();
  renderClientList();

  if (
    selectedLeadId &&
    getSelectedLead()
  ) {
    renderDetail();
  }

  dashboardStatus.textContent =
    `${leads.length} clients • Live`;
}


function renderOverview(lead) {
  const email =
    lead.email
      ? `
        <a href="mailto:${escapeHtml(lead.email)}">
          ${escapeHtml(lead.email)}
        </a>
      `
      : "—";

  const phone =
    lead.phone
      ? `
        <a href="tel:${
          escapeHtml(
            String(lead.phone)
              .replace(/[^\d+]/g, "")
          )
        }">
          ${escapeHtml(lead.phone)}
        </a>
      `
      : "—";

  detailContent.innerHTML = `
    <section class="mobile-card">

      <h3>Client</h3>

      <div class="info-list">

        <div class="info-row">
          <span>Email</span>
          <strong>${email}</strong>
        </div>

        <div class="info-row">
          <span>Phone</span>
          <strong>${phone}</strong>
        </div>

        <div class="info-row">
          <span>Business type</span>
          <strong>
            ${escapeHtml(lead.trade || "—")}
          </strong>
        </div>

        <div class="info-row">
          <span>Area</span>
          <strong>
            ${escapeHtml(lead.area || "—")}
          </strong>
        </div>

        <div class="info-row">
          <span>Source</span>
          <strong>
            ${
              escapeHtml(
                lead.attribution_source ||
                "—"
              )
            }
          </strong>
        </div>

      </div>

      <div class="message-box">
        ${
          escapeHtml(
            lead.message ||
            "No additional message."
          )
        }
      </div>

    </section>
  `;
}


function renderProject(lead) {
  const preview =
    normaliseUrl(
      lead.preview_url
    );

  const live =
    normaliseUrl(
      lead.live_url
    );

  const current =
    normaliseUrl(
      lead.current_site
    );

  detailContent.innerHTML = `
    <section class="mobile-card">

      <h3>Project</h3>

      <div class="info-list">

        <div class="info-row">
          <span>Package</span>
          <strong>
            ${
              escapeHtml(
                lead.package || "—"
              )
            }
          </strong>
        </div>

        <div class="info-row">
          <span>Care plan</span>
          <strong>
            ${
              escapeHtml(
                lead.care_plan || "—"
              )
            }
          </strong>
        </div>

        <div class="info-row">
          <span>Status</span>
          <strong>
            ${
              escapeHtml(
                prettyStatus(
                  lead.status
                )
              )
            }
          </strong>
        </div>

      </div>

      ${
        preview
          ? `
            <a
              class="quick-link"
              href="${escapeHtml(preview)}"
              target="_blank"
              rel="noopener"
            >
              Website preview
              <span>↗</span>
            </a>
          `
          : ""
      }

      ${
        live
          ? `
            <a
              class="quick-link"
              href="${escapeHtml(live)}"
              target="_blank"
              rel="noopener"
            >
              Live website
              <span>↗</span>
            </a>
          `
          : ""
      }

      ${
        current
          ? `
            <a
              class="quick-link"
              href="${escapeHtml(current)}"
              target="_blank"
              rel="noopener"
            >
              Existing website
              <span>↗</span>
            </a>
          `
          : ""
      }

    </section>

    <div class="readonly-note">
      Mobile CRM v1 is currently read-only.
      Project editing will be enabled after
      the mobile layout is approved.
    </div>
  `;
}


function renderPayments(lead) {
  const projectTotal =
    lead.project_total ??
    PACKAGE_TOTALS[
      lead.package
    ] ??
    null;

  const deposit =
    Number(
      lead.deposit_amount || 0
    );

  const paidDeposit =
    Boolean(
      lead.deposit_paid_at
    );

  const remaining =
    projectTotal !== null
      ? Math.max(
          Number(projectTotal) -
          (
            paidDeposit
              ? deposit
              : 0
          ),
          0
        )
      : null;

  detailContent.innerHTML = `
    <section class="mobile-card">

      <h3>Payments</h3>

      <div class="payment-grid">

        <div class="payment-box">
          <span>PROJECT TOTAL</span>
          <strong>
            ${money(projectTotal)}
          </strong>
        </div>

        <div class="payment-box">
          <span>DEPOSIT</span>
          <strong>
            ${
              deposit
                ? money(deposit)
                : "—"
            }
          </strong>
        </div>

        <div class="payment-box">
          <span>REMAINING</span>
          <strong>
            ${money(remaining)}
          </strong>
        </div>

        <div class="payment-box">
          <span>PAYMENT STATE</span>
          <strong style="font-size:13px">
            ${
              lead.balance_paid_at
                ? "Paid in full"
                : paidDeposit
                  ? "Deposit paid"
                  : lead.deposit_url
                    ? "Deposit sent"
                    : "Not paid"
            }
          </strong>
        </div>

      </div>

    </section>

    <div class="readonly-note">
      Payment actions are disabled in
      mobile v1 while we test the layout.
    </div>
  `;
}


function renderChat(lead) {
  detailContent.innerHTML = `
    <section class="mobile-card chat-card">

      <div class="chat-title-row">
        <div>
          <h3>Conversation</h3>

          <span>
            ${escapeHtml(lead.email || "")}
          </span>
        </div>

        <span class="chat-live-dot">
          Live
        </span>
      </div>

      <div
        id="mobile-conversation-history"
        class="mobile-conversation-history"
      >
        <p class="conversation-empty">
          Loading conversation…
        </p>
      </div>

      <form
        id="mobile-reply-form"
        class="mobile-reply-form"
      >

        <textarea
          id="mobile-reply-text"
          rows="3"
          maxlength="5000"
          placeholder="Write your reply..."
          required
        ></textarea>

        <div class="mobile-reply-actions">

          <span
            id="mobile-reply-status"
            class="mobile-reply-status"
          ></span>

          <button
            id="mobile-send-reply"
            class="primary-button"
            type="submit"
          >
            Send
          </button>

        </div>

      </form>

    </section>
  `;

  startConversationPolling(
    lead
  );
}

function renderDetail() {
  if (
    activeDetailTab !== "chat"
  ) {
    stopConversationPolling();
  }

  const lead =
    getSelectedLead();

  if (!lead) {
    showClients();
    return;
  }

  const business =
    lead.business ||
    "Unnamed business";

  detailBusiness.textContent =
    business;

  detailPerson.textContent =
    [
      lead.name,
      lead.trade
    ]
      .filter(Boolean)
      .join(" • ");

  clientAvatar.textContent =
    business
      .trim()
      .charAt(0)
      .toUpperCase() ||
    "G";

  const category =
    categoryForLead(lead);

  detailStatus.className =
    `status-badge status-${category}`;

  detailStatus.textContent =
    prettyStatus(
      lead.status
    );

  if (
    activeDetailTab ===
    "project"
  ) {
    renderProject(lead);
    return;
  }

  if (
    activeDetailTab ===
    "payments"
  ) {
    renderPayments(lead);
    return;
  }

  if (
    activeDetailTab ===
    "chat"
  ) {
    renderChat(lead);
    return;
  }

  renderOverview(lead);
}


function updateDetailTabs() {
  document
    .querySelectorAll(
      ".detail-tab"
    )
    .forEach(
      button => {
        button.classList.toggle(
          "active",
          button.dataset.tab ===
            activeDetailTab
        );
      }
    );
}


function startRealtime() {
  stopRealtime();

  realtimeChannel =
    supabaseClient
      .channel(
        "mobile-crm-leads"
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads"
        },
        () => {
          loadLeads({
            background: true
          });
        }
      )
      .subscribe();
}


function stopRealtime() {
  if (
    realtimeChannel &&
    supabaseClient
  ) {
    supabaseClient
      .removeChannel(
        realtimeChannel
      );
  }

  realtimeChannel = null;
}


loginForm.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    if (!supabaseClient) {
      return;
    }

    loginStatus.textContent =
      "Signing in…";

    const email =
      document
        .getElementById(
          "admin-email"
        )
        .value
        .trim();

    const password =
      document
        .getElementById(
          "admin-password"
        )
        .value;

    const { error } =
      await supabaseClient.auth
        .signInWithPassword({
          email,
          password
        });

    if (error) {
      loginStatus.textContent =
        error.message;
      return;
    }

    loginStatus.textContent = "";

    showDashboard();

    await Promise.all([
      loadLeads(),
      loadPaymentMode()
    ]);

    startRealtime();
  }
);


logoutButton.addEventListener(
  "click",
  async () => {
    stopRealtime();
    stopConversationPolling();

    if (supabaseClient) {
      await supabaseClient.auth
        .signOut();
    }

    leads = [];
    selectedLeadId = null;

    showClients();
    showLogin();
  }
);


backButton.addEventListener(
  "click",
  showClients
);


searchInput.addEventListener(
  "input",
  renderClientList
);


document
  .querySelectorAll(
    ".filter-pill"
  )
  .forEach(
    button => {
      button.addEventListener(
        "click",
        () => {
          activeView =
            button.dataset.view;

          document
            .querySelectorAll(
              ".filter-pill"
            )
            .forEach(
              item =>
                item.classList.toggle(
                  "active",
                  item === button
                )
            );

          renderClientList();
        }
      );
    }
  );


document
  .querySelectorAll(
    ".detail-tab"
  )
  .forEach(
    button => {
      button.addEventListener(
        "click",
        () => {
          stopConversationPolling();

          activeDetailTab =
            button.dataset.tab;

          updateDetailTabs();
          renderDetail();
        }
      );
    }
  );


async function init() {
  if (!supabaseClient) {
    showLogin();
    return;
  }

  const {
    data
  } =
    await supabaseClient.auth
      .getSession();

  if (!data.session) {
    showLogin();
    return;
  }

  showDashboard();

  await Promise.all([
    loadLeads(),
    loadPaymentMode()
  ]);

  startRealtime();
}


init();
