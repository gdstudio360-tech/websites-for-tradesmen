const config =
  window.GD_CONFIG || {};

const configured =
  Boolean(
    config.SUPABASE_URL &&
    config.SUPABASE_PUBLISHABLE_KEY
  );

const loginView =
  document.getElementById(
    "login-view"
  );

const dashboardView =
  document.getElementById(
    "dashboard-view"
  );

const loginForm =
  document.getElementById(
    "login-form"
  );

const loginStatus =
  document.getElementById(
    "login-status"
  );

const dashboardStatus =
  document.getElementById(
    "dashboard-status"
  );

const logoutButton =
  document.getElementById(
    "logout-button"
  );

const themeToggle =
  document.getElementById(
    "theme-toggle"
  );

const paymentModeBadge =
  document.getElementById(
    "payment-mode-badge"
  );

const paymentModeSwitch =
  document.getElementById(
    "payment-mode-switch"
  );

const refreshButton =
  document.getElementById(
    "refresh-button"
  );

const searchInput =
  document.getElementById(
    "search-input"
  );

const sortSelect =
  document.getElementById(
    "sort-select"
  );

const clientList =
  document.getElementById(
    "client-list"
  );

const clientDetail =
  document.getElementById(
    "client-detail"
  );

const visibleCount =
  document.getElementById(
    "visible-count"
  );

const pendingBanner =
  document.getElementById(
    "pending-enquiry-banner"
  );


const completedArchiveButton =
  document.getElementById(
    "open-completed-clients"
  );

const rejectedArchiveButton =
  document.getElementById(
    "open-rejected-clients"
  );

const completedArchiveCount =
  document.getElementById(
    "archive-completed-count"
  );

const rejectedArchiveCount =
  document.getElementById(
    "archive-rejected-count"
  );

const archiveModal =
  document.getElementById(
    "client-archive-modal"
  );

const archiveTitle =
  document.getElementById(
    "client-archive-title"
  );

const archiveSummary =
  document.getElementById(
    "client-archive-summary"
  );

const archiveSearch =
  document.getElementById(
    "client-archive-search"
  );

const archiveList =
  document.getElementById(
    "client-archive-list"
  );

const archiveCloseButton =
  document.getElementById(
    "close-client-archive"
  );


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

const CARE_BY_PACKAGE = {
  "Starter — £249":
    "Website Care — £29/month",

  "Business — £399":
    "Business Care — £59/month",

  "Pro — £599":
    "Pro Care — £99/month"
};


let client = null;
let leads = [];
let activeView = "new";
let selectedLeadId = null;
let sumupTestMode = null;

let archiveMode = null;

let realtimeChannel = null;
let pendingNewCount = 0;

let conversationTimer = null;
let conversationLeadId = null;
let conversationMessageIds =
  new Set();


if (
  configured &&
  window.supabase
) {
  client =
    window.supabase
      .createClient(
        config.SUPABASE_URL,
        config.SUPABASE_PUBLISHABLE_KEY
      );
} else {
  loginStatus.textContent =
    "Supabase is not connected.";
}


function applyCrmTheme(
  theme
) {
  const selected =
    theme === "dark"
      ? "dark"
      : "light";

  document.documentElement
    .setAttribute(
      "data-theme",
      selected
    );

  localStorage.setItem(
    "gd-crm-theme",
    selected
  );

  if (themeToggle) {
    const dark =
      selected === "dark";

    themeToggle.textContent =
      dark
        ? "Light mode"
        : "Dark mode";

    themeToggle.setAttribute(
      "aria-pressed",
      dark
        ? "true"
        : "false"
    );
  }

  const themeMeta =
    document.querySelector(
      'meta[name="theme-color"]'
    );

  if (themeMeta) {
    themeMeta.setAttribute(
      "content",
      selected === "dark"
        ? "#070b12"
        : "#08111f"
    );
  }
}


const savedCrmTheme =
  localStorage.getItem(
    "gd-crm-theme"
  ) || "light";

applyCrmTheme(
  savedCrmTheme
);


themeToggle
  ?.addEventListener(
    "click",
    () => {

      const current =
        document.documentElement
          .getAttribute(
            "data-theme"
          );

      applyCrmTheme(
        current === "dark"
          ? "light"
          : "dark"
      );
    }
  );


function moneyFromPence(
  value
) {
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


function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function escapeAttr(
  value
) {
  return escapeHtml(value);
}


function prettyStatus(
  value
) {
  return String(
    value || "new"
  )
    .replaceAll("_", " ")
    .replace(
      /\b\w/g,
      (c) => c.toUpperCase()
    );
}


function categoryForLead(
  lead
) {
  if (
    lead.status ===
    "new"
  ) {
    return "new";
  }

  if (
    IN_PROGRESS_STATUSES
      .includes(
        lead.status
      )
  ) {
    return "progress";
  }

  if (
    lead.status ===
    "completed"
  ) {
    return "completed";
  }

  if (
    lead.status ===
    "rejected"
  ) {
    return "rejected";
  }

  return "progress";
}


function packagePrice(
  packageName
) {
  return (
    PACKAGE_TOTALS[
      packageName
    ] || null
  );
}


function workflowStepIndex(
  lead
) {
  const status =
    lead?.status || "new";

  if (status === "completed") {
    return 6;
  }

  if (status === "balance_due") {
    return 5;
  }

  if (
    status === "review" &&
    lead?.live_url
  ) {
    return 4;
  }

  const map = {
    new: 0,
    approved: 1,
    deposit_sent: 1,
    deposit_paid: 2,
    building: 2,
    review: 3
  };

  return map[status] ?? 0;
}


function workflowProgressHtml(
  lead
) {
  if (
    lead.status ===
    "rejected"
  ) {
    return `
      <div class="workflow-rejected">
        <strong>Rejected</strong>
        <span>
          This enquiry is currently
          outside the active workflow.
        </span>
      </div>
    `;
  }

  const steps = [
    "Enquiry",
    "Deposit",
    "Build",
    "Review",
    "Launch",
    "Final payment",
    "Complete"
  ];

  const current =
    workflowStepIndex(
      lead
    );

  return `
    <div class="workflow-progress">
      ${
        steps
          .map(
            (label, index) => {
              let state = "";

              if (
                index < current
              ) {
                state = "done";
              } else if (
                index === current
              ) {
                state = "current";
              }

              return `
                <div
                  class="workflow-step ${state}"
                >
                  <span class="workflow-dot">
                    ${
                      index < current
                        ? "✓"
                        : index + 1
                    }
                  </span>

                  <small>
                    ${escapeHtml(label)}
                  </small>
                </div>
              `;
            }
          )
          .join("")
      }
    </div>
  `;
}


function normaliseUrl(
  value
) {
  const raw =
    String(
      value || ""
    ).trim();

  if (!raw) {
    return null;
  }

  let candidate = raw;

  if (
    !/^https?:\/\//i
      .test(candidate)
  ) {
    candidate =
      `https://${candidate}`;
  }

  try {
    const url =
      new URL(candidate);

    if (
      ![
        "http:",
        "https:"
      ].includes(
        url.protocol
      )
    ) {
      return null;
    }

    return url.toString();

  } catch (_) {
    return null;
  }
}


function safeUrl(
  value
) {
  return (
    normaliseUrl(value) ||
    ""
  );
}


function cleanCustomerReply(
  value
) {
  const text =
    String(value || "")
      .replace(
        /\r\n/g,
        "\n"
      )
      .trim();

  if (!text) {
    return "";
  }

  const lines =
    text.split("\n");

  let cutAt =
    lines.length;

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
        .replace(
          /\p{Diacritic}/gu,
          ""
        )
        .toLowerCase();

    const quoted =
      line.startsWith(">") ||
      normalised
        .endsWith("rase:") ||
      normalised
        .endsWith("wrote:") ||
      /^on .+ wrote:$/i
        .test(line) ||
      /^(from|nuo|sent|issiusta|subject|tema):\s+/i
        .test(normalised);

    if (quoted) {
      cutAt = i;
      break;
    }
  }

  return lines
    .slice(
      0,
      cutAt
    )
    .join("\n")
    .trim();
}



async function loadPaymentMode() {
  if (
    !client ||
    !paymentModeBadge
  ) {
    return;
  }

  paymentModeBadge.hidden =
    false;

  paymentModeBadge.className =
    "payment-mode-badge checking";

  paymentModeBadge.textContent =
    "CHECKING PAYMENTS…";

  if (paymentModeSwitch) {
    paymentModeSwitch.hidden =
      true;
  }

  const {
    data,
    error
  } =
    await client.functions
      .invoke(
        "admin-system-status",
        {
          body: {}
        }
      );

  if (
    error ||
    !data?.ok
  ) {
    sumupTestMode =
      null;

    paymentModeBadge.className =
      "payment-mode-badge unknown";

    paymentModeBadge.textContent =
      "PAYMENT MODE UNKNOWN";

    return;
  }

  sumupTestMode =
    data.sumup_test_mode ===
    true;

  paymentModeBadge.className =
    sumupTestMode
      ? "payment-mode-badge test"
      : "payment-mode-badge live";

  paymentModeBadge.textContent =
    sumupTestMode
      ? "SUMUP TEST MODE"
      : "SUMUP LIVE PAYMENTS";

  if (paymentModeSwitch) {
    paymentModeSwitch.hidden =
      false;

    paymentModeSwitch.className =
      sumupTestMode
        ? "payment-mode-switch to-live"
        : "payment-mode-switch to-test";

    paymentModeSwitch.textContent =
      sumupTestMode
        ? "Switch to LIVE"
        : "Switch to TEST";
  }

  if (selectedLeadId) {
    renderSelectedLead();
  }
}


paymentModeSwitch
  ?.addEventListener(
    "click",
    async () => {
      if (
        typeof sumupTestMode !==
        "boolean"
      ) {
        return;
      }

      const targetTestMode =
        !sumupTestMode;

      const word =
        targetTestMode
          ? "TEST"
          : "LIVE";

      const message =
        targetTestMode
          ? (
              "Switch SumUp to TEST mode?\n\n" +
              "New payments will use sandbox money.\n\n" +
              "Type TEST to confirm."
            )
          : (
              "Switch SumUp to LIVE mode?\n\n" +
              "NEW PAYMENTS WILL USE REAL MONEY.\n\n" +
              "Type LIVE to confirm."
            );

      const confirmation =
        prompt(message);

      if (
        String(
          confirmation || ""
        )
          .trim()
          .toUpperCase() !==
        word
      ) {
        return;
      }

      paymentModeSwitch.disabled =
        true;

      paymentModeSwitch.textContent =
        "Switching…";

      const {
        data,
        error
      } =
        await client.functions
          .invoke(
            "admin-payment-mode",
            {
              body: {
                test_mode:
                  targetTestMode,
                confirmation:
                  word
              }
            }
          );

      if (
        error ||
        !data?.ok
      ) {
        dashboardStatus.textContent =
          data?.error ||
          error?.message ||
          "Could not change payment mode.";

        paymentModeSwitch.disabled =
          false;

        await loadPaymentMode();

        return;
      }

      await loadPaymentMode();

      paymentModeSwitch.disabled =
        false;

      dashboardStatus.textContent =
        targetTestMode
          ? "SumUp TEST mode is active."
          : "SumUp LIVE payments are active.";
    }
  );

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
  if (!client) {
    showLogin();
    return;
  }

  const { data } =
    await client.auth
      .getSession();

  if (
    data.session
  ) {
    showDashboard();

    await Promise.all([
      loadLeads({
        refreshDetail: true
      }),
      loadPaymentMode()
    ]);

    startRealtime();

  } else {
    showLogin();
  }
}


loginForm
  ?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      if (!client) {
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
        await client.auth
          .signInWithPassword({
            email,
            password
          });

      if (error) {
        loginStatus.textContent =
          error.message;

        return;
      }

      loginStatus.textContent =
        "";

      showDashboard();

      await Promise.all([
        loadLeads({
          refreshDetail: true
        }),
        loadPaymentMode()
      ]);

      startRealtime();
    }
  );


logoutButton
  ?.addEventListener(
    "click",
    async () => {
      stopRealtime();
      stopConversationPolling();

      if (client) {
        await client.auth
          .signOut();
      }

      leads = [];
      selectedLeadId = null;

      showLogin();
    }
  );


refreshButton
  ?.addEventListener(
    "click",
    () =>
      loadLeads({
        refreshDetail: true
      })
  );


function getLeadById(
  id
) {
  return leads.find(
    (lead) =>
      String(lead.id) ===
      String(id)
  );
}


function visibleLeads() {
  const query =
    String(
      searchInput?.value ||
      ""
    )
      .trim()
      .toLowerCase();

  let rows =
    leads.filter(
      (lead) => {
        const category =
          categoryForLead(
            lead
          );

        /*
         * When search is empty, respect the selected CRM list.
         * When the user types a search, search ALL clients
         * across New / In Progress / Completed / Rejected.
         */
        const matchesView =
          query ||
          (
            activeView === "all" &&
            ![
              "completed",
              "rejected"
            ].includes(
              category
            )
          ) ||
          category === activeView;

        if (!matchesView) {
          return false;
        }

        if (!query) {
          return true;
        }

        const haystack = [
          lead.business,
          lead.name,
          lead.email,
          lead.phone,
          lead.trade,
          lead.area,
          lead.package,
          lead.care_plan,
          lead.status,
          lead.preview_url,
          lead.live_url
        ]
          .join(" ")
          .toLowerCase();

        return haystack
          .includes(query);
      }
    );

  const sort =
    sortSelect?.value ||
    "newest";

  rows =
    [...rows].sort(
      (a,b) => {

        if (
          sort ===
          "oldest"
        ) {
          return (
            new Date(
              a.created_at
            ) -
            new Date(
              b.created_at
            )
          );
        }

        if (
          sort ===
          "business"
        ) {
          return String(
            a.business || ""
          ).localeCompare(
            String(
              b.business || ""
            )
          );
        }

        return (
          new Date(
            b.created_at
          ) -
          new Date(
            a.created_at
          )
        );
      }
    );

  return rows;
}


async function loadLeads(
  options = {}
) {
  if (!client) {
    return;
  }

  const refreshDetail =
    options.refreshDetail ===
    true;

  const background =
    options.background ===
    true;

  if (!background) {
    dashboardStatus.textContent =
      "Loading clients…";
  }

  const {
    data,
    error
  } =
    await client
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

  leads =
    data || [];

  /*
   * When a selected client's status changes
   * (for example New -> In Progress),
   * automatically open the correct CRM list.
   */
  if (
    refreshDetail &&
    selectedLeadId &&
    activeView !== "all" &&
    !String(
      searchInput?.value ||
      ""
    ).trim()
  ) {
    const selected =
      getLeadById(
        selectedLeadId
      );

    if (selected) {
      const nextView =
        categoryForLead(
          selected
        );

      if (
        ![
          "completed",
          "rejected"
        ].includes(
          nextView
        ) &&
        nextView !==
        activeView
      ) {
        activeView =
          nextView;

        updateActiveTab();
      }
    }
  }

  renderCounts();
  renderClientList();

  if (
    selectedLeadId &&
    !getLeadById(
      selectedLeadId
    )
  ) {
    selectedLeadId =
      null;
  }

  if (
    !selectedLeadId
  ) {
    const first =
      visibleLeads()[0] ||
      leads[0];

    if (first) {
      selectedLeadId =
        first.id;
    }
  }

  renderClientList();

  if (
    refreshDetail ||
    !clientDetail
      .querySelector(
        ".detail-header"
      )
  ) {
    renderSelectedLead();
  }

  dashboardStatus.textContent =
    `${leads.length} clients • Live`;
}


function renderCounts() {
  const counts = {
    new: 0,
    progress: 0,
    completed: 0,
    rejected: 0,
    all: leads.length
  };

  for (
    const lead of leads
  ) {
    const category =
      categoryForLead(
        lead
      );

    if (
      counts[
        category
      ] !== undefined
    ) {
      counts[
        category
      ] += 1;
    }
  }

  document
    .getElementById(
      "count-new"
    )
    .textContent =
      counts.new;

  document
    .getElementById(
      "count-progress"
    )
    .textContent =
      counts.progress;

  document
    .getElementById(
      "count-completed"
    )
    .textContent =
      counts.completed;

  document
    .getElementById(
      "count-rejected"
    )
    .textContent =
      counts.rejected;

  document
    .getElementById(
      "count-all"
    )
    .textContent =
      counts.all;


  if (
    completedArchiveCount
  ) {
    completedArchiveCount
      .textContent =
        counts.completed;
  }


  if (
    rejectedArchiveCount
  ) {
    rejectedArchiveCount
      .textContent =
        counts.rejected;
  }


  if (
    archiveMode
  ) {
    renderArchiveList();
  }
}


function clientPaymentState(
  lead
) {
  if (
    lead.balance_paid_at ||
    lead.status ===
      "completed"
  ) {
    return {
      label: "✓ Paid in full",
      className: "paid"
    };
  }

  if (
    lead.balance_sent_at ||
    lead.status ===
      "balance_due"
  ) {
    return {
      label: "Balance due",
      className: "due"
    };
  }

  if (
    lead.deposit_paid_at
  ) {
    return {
      label: "✓ Deposit paid",
      className: "paid"
    };
  }

  if (
    lead.deposit_url ||
    lead.status ===
      "deposit_sent"
  ) {
    return {
      label: "Deposit sent",
      className: "waiting"
    };
  }

  if (
    lead.status ===
      "approved"
  ) {
    return {
      label: "Approved",
      className: "waiting"
    };
  }

  if (
    lead.status ===
      "rejected"
  ) {
    return {
      label: "Rejected",
      className: "rejected"
    };
  }

  return {
    label: "New enquiry",
    className: "new"
  };
}


function packageGroupKey(
  lead
) {
  const value =
    String(
      lead?.package || ""
    )
      .trim()
      .toLowerCase();

  if (
    value.startsWith(
      "starter"
    )
  ) {
    return "starter";
  }

  if (
    value.startsWith(
      "business"
    )
  ) {
    return "business";
  }

  if (
    value.startsWith(
      "pro"
    )
  ) {
    return "pro";
  }

  return "unassigned";
}


function renderClientList() {
  if (!clientList) {
    return;
  }

  const rows =
    visibleLeads();

  visibleCount.textContent =
    `${rows.length}`;

  clientList.innerHTML =
    "";

  const groups = [
    {
      key: "starter",
      label: "Starter — £249"
    },
    {
      key: "business",
      label: "Business — £399"
    },
    {
      key: "pro",
      label: "Pro — £599"
    }
  ];

  const grouped = {
    starter: [],
    business: [],
    pro: [],
    unassigned: []
  };

  rows.forEach(
    lead => {
      grouped[
        packageGroupKey(
          lead
        )
      ].push(
        lead
      );
    }
  );

  if (
    grouped.unassigned.length
  ) {
    groups.push({
      key: "unassigned",
      label: "Not assigned"
    });
  }


  for (
    const group of groups
  ) {
    const groupRows =
      grouped[group.key];

    const section =
      document.createElement(
        "section"
      );

    section.className =
      `package-client-group package-${group.key}`;

    const heading =
      document.createElement(
        "div"
      );

    heading.className =
      "package-client-group-head";

    heading.innerHTML = `
      <strong>
        ${escapeHtml(
          group.label
        )}
      </strong>

      <span>
        ${groupRows.length}
      </span>
    `;

    const groupList =
      document.createElement(
        "div"
      );

    groupList.className =
      "package-client-group-list";

    if (
      !groupRows.length
    ) {
      groupList.innerHTML = `
        <div
          class="package-client-empty"
        >
          No clients
        </div>
      `;
    }


    for (
      const lead of groupRows
    ) {
      const wrapper =
        document.createElement(
          "div"
        );

      wrapper.className =
        "client-row-card";

      if (
        String(
          lead.id
        ) ===
        String(
          selectedLeadId
        )
      ) {
        wrapper.classList
          .add("active");
      }


      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.className =
        "client-row-main";


      const date =
        lead.created_at
          ? new Date(
              lead.created_at
            ).toLocaleDateString(
              "en-GB"
            )
          : "";


      const paymentState =
        clientPaymentState(
          lead
        );


      const preview =
        safeUrl(
          lead.preview_url
        );

      const live =
        safeUrl(
          lead.live_url
        );


      button.innerHTML = `
        <div class="client-row-top">

          <span
            class="client-row-business"
          >
            ${
              escapeHtml(
                lead.business ||
                "Unnamed business"
              )
            }
          </span>

          <span
            class="client-row-status status-${
              escapeAttr(
                categoryForLead(
                  lead
                )
              )
            }"
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


        <span
          class="client-row-person"
        >
          ${
            escapeHtml(
              lead.name || ""
            )
          }
        </span>


        <span
          class="client-row-bottom"
        >

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

        </span>
      `;


      button.addEventListener(
        "click",
        () => {

          if (
            String(
              selectedLeadId
            ) ===
            String(
              lead.id
            )
          ) {
            return;
          }


          const draft =
            clientDetail
              .querySelector(
                "#reply-text"
              );

          if (
            draft &&
            draft.value.trim()
          ) {
            const leave =
              confirm(
                "You have an unsent reply. Switch client and discard it?"
              );

            if (!leave) {
              return;
            }
          }


          selectedLeadId =
            lead.id;

          renderClientList();
          renderSelectedLead();


          if (
            window.innerWidth <
            760
          ) {
            clientDetail
              .scrollIntoView({
                behavior:
                  "smooth",
                block:
                  "start"
              });
          }
        }
      );


      const quick =
        document.createElement(
          "div"
        );

      quick.className =
        "client-row-quick";


      const payment =
        document.createElement(
          "span"
        );

      payment.className =
        `client-payment-state ${
          paymentState.className
        }`;

      payment.textContent =
        paymentState.label;

      quick.appendChild(
        payment
      );


      const links =
        document.createElement(
          "div"
        );

      links.className =
        "client-row-links";


      if (preview) {
        const previewLink =
          document.createElement(
            "a"
          );

        previewLink.href =
          preview;

        previewLink.target =
          "_blank";

        previewLink.rel =
          "noopener";

        previewLink.textContent =
          "Preview ↗";

        previewLink.title =
          "Open website preview";

        links.appendChild(
          previewLink
        );
      }


      if (live) {
        const liveLink =
          document.createElement(
            "a"
          );

        liveLink.href =
          live;

        liveLink.target =
          "_blank";

        liveLink.rel =
          "noopener";

        liveLink.textContent =
          "Live ↗";

        liveLink.title =
          "Open live website";

        links.appendChild(
          liveLink
        );
      }


      quick.appendChild(
        links
      );


      wrapper.append(
        button,
        quick
      );

      groupList.appendChild(
        wrapper
      );
    }


    section.append(
      heading,
      groupList
    );

    clientList.appendChild(
      section
    );
  }
}



function archiveRows(
  mode
) {
  const query =
    String(
      archiveSearch?.value ||
      ""
    )
      .trim()
      .toLowerCase();

  let rows =
    leads.filter(
      lead =>
        lead.status ===
        mode
    );

  if (query) {
    rows =
      rows.filter(
        lead => {
          const haystack = [
            lead.business,
            lead.name,
            lead.email,
            lead.phone,
            lead.package,
            lead.trade,
            lead.area
          ]
            .join(" ")
            .toLowerCase();

          return haystack
            .includes(
              query
            );
        }
      );
  }

  return [...rows]
    .sort(
      (a,b) =>
        new Date(
          b.updated_at ||
          b.created_at
        ) -
        new Date(
          a.updated_at ||
          a.created_at
        )
    );
}


function renderArchiveList() {
  if (
    !archiveMode ||
    !archiveList
  ) {
    return;
  }

  const rows =
    archiveRows(
      archiveMode
    );


  if (archiveTitle) {
    archiveTitle.textContent =
      archiveMode ===
        "completed"
        ? "Completed clients"
        : "Rejected clients";
  }


  if (archiveSummary) {
    const allCount =
      leads.filter(
        lead =>
          lead.status ===
          archiveMode
      ).length;

    archiveSummary.textContent =
      `${allCount} client${
        allCount === 1
          ? ""
          : "s"
      }`;
  }


  archiveList.innerHTML =
    "";


  if (!rows.length) {
    archiveList.innerHTML = `
      <div class="client-archive-empty">
        ${
          archiveSearch?.value
            ?.trim()
            ? "No matching clients."
            : archiveMode ===
                "completed"
              ? "No completed clients yet."
              : "No rejected clients yet."
        }
      </div>
    `;

    return;
  }


  for (
    const lead of rows
  ) {
    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className =
      "client-archive-item";


    const dateValue =
      lead.updated_at ||
      lead.created_at;

    const date =
      dateValue
        ? new Date(
            dateValue
          )
            .toLocaleDateString(
              "en-GB"
            )
        : "";


    button.innerHTML = `
      <div class="client-archive-item-top">

        <span class="client-archive-business">
          ${
            escapeHtml(
              lead.business ||
              "Unnamed business"
            )
          }
        </span>

        <span class="client-archive-status">
          ${
            escapeHtml(
              prettyStatus(
                lead.status
              )
            )
          }
        </span>

      </div>

      <div class="client-archive-meta">

        <span>
          ${
            escapeHtml(
              lead.name ||
              "No name"
            )
          }
        </span>

        <span>
          ${
            escapeHtml(
              lead.package ||
              "No package"
            )
          }
        </span>

        <span>
          ${escapeHtml(date)}
        </span>

      </div>

      <div class="client-archive-meta">

        ${
          lead.email
            ? `<span>${escapeHtml(lead.email)}</span>`
            : ""
        }

        ${
          lead.phone
            ? `<span>${escapeHtml(lead.phone)}</span>`
            : ""
        }

      </div>
    `;


    button.addEventListener(
      "click",
      () => {

        const draft =
          clientDetail
            ?.querySelector(
              "#reply-text"
            );

        if (
          draft &&
          draft.value.trim()
        ) {
          const leave =
            confirm(
              "You have an unsent reply. Switch client and discard it?"
            );

          if (!leave) {
            return;
          }
        }


        selectedLeadId =
          lead.id;

        closeClientArchive();

        renderClientList();
        renderSelectedLead();


        if (
          window.innerWidth <
          760
        ) {
          clientDetail
            ?.scrollIntoView({
              behavior:
                "smooth",
              block:
                "start"
            });
        }
      }
    );


    archiveList
      .appendChild(
        button
      );
  }
}


function openClientArchive(
  mode
) {
  if (
    !archiveModal
  ) {
    return;
  }

  archiveMode =
    mode;

  if (
    archiveSearch
  ) {
    archiveSearch.value =
      "";
  }

  renderArchiveList();

  archiveModal.hidden =
    false;

  document.body
    .classList
    .add(
      "archive-modal-open"
    );


  setTimeout(
    () =>
      archiveSearch
        ?.focus(),
    50
  );
}


function closeClientArchive() {
  if (
    !archiveModal
  ) {
    return;
  }

  archiveModal.hidden =
    true;

  archiveMode =
    null;

  document.body
    .classList
    .remove(
      "archive-modal-open"
    );
}


completedArchiveButton
  ?.addEventListener(
    "click",
    () =>
      openClientArchive(
        "completed"
      )
  );


rejectedArchiveButton
  ?.addEventListener(
    "click",
    () =>
      openClientArchive(
        "rejected"
      )
  );


archiveCloseButton
  ?.addEventListener(
    "click",
    closeClientArchive
  );


document
  .querySelectorAll(
    "[data-archive-close]"
  )
  .forEach(
    element => {
      element
        .addEventListener(
          "click",
          closeClientArchive
        );
    }
  );


archiveSearch
  ?.addEventListener(
    "input",
    renderArchiveList
  );


document
  .addEventListener(
    "keydown",
    event => {
      if (
        event.key ===
          "Escape" &&
        archiveModal &&
        !archiveModal.hidden
      ) {
        closeClientArchive();
      }
    }
  );


function careOptionsHtml(
  packageName,
  selected
) {
  const values = [
    "No care plan"
  ];

  const matching =
    CARE_BY_PACKAGE[
      packageName
    ];

  if (matching) {
    values.push(
      matching
    );
  }

  return values
    .map(
      (value) =>
        `
          <option
            value="${escapeAttr(value)}"
            ${
              value ===
              selected
                ? "selected"
                : ""
            }
          >
            ${escapeHtml(value)}
          </option>
        `
    )
    .join("");
}


function packageOptionsHtml(
  selected
) {
  const values = [
    "Not sure — recommend one",
    "Starter — £249",
    "Business — £399",
    "Pro — £599"
  ];

  return values
    .map(
      (value) =>
        `
          <option
            value="${escapeAttr(value)}"
            ${
              value ===
              selected
                ? "selected"
                : ""
            }
          >
            ${escapeHtml(value)}
          </option>
        `
    )
    .join("");
}


function renderSelectedLead() {
  stopConversationPolling();

  const lead =
    getLeadById(
      selectedLeadId
    );

  if (!lead) {
    clientDetail.innerHTML =
      `
        <div class="empty-detail">
          <strong>Select a client</strong>
          <p>
            Choose a client
            from the list.
          </p>
        </div>
      `;

    return;
  }

  const projectTotal =
    lead.project_total ??
    packagePrice(
      lead.package
    );

  const depositAmount =
    Number(
      lead.deposit_amount ||
      0
    );

  const depositPaid =
    Boolean(
      lead.deposit_paid_at
    );

  const calculatedBalance =
    projectTotal
      ? Math.max(
          Number(
            projectTotal
          ) -
          depositAmount,
          0
        )
      : null;

  const preview =
    safeUrl(
      lead.preview_url
    );

  const live =
    safeUrl(
      lead.live_url
    );

  const current =
    safeUrl(
      lead.current_site
    );

  const packageKey =
    String(
      lead.package || ""
    )
      .trim()
      .toLowerCase();

  const isStarterPackage =
    packageKey.startsWith(
      "starter"
    );

  const isBusinessPackage =
    packageKey.startsWith(
      "business"
    );

  const isProPackage =
    packageKey.startsWith(
      "pro"
    );

  const hasContentPortal =
    isStarterPackage ||
    isBusinessPackage ||
    isProPackage;

  const contentToken =
    String(
      lead.content_token || ""
    ).trim();

  const contentPortalFile =
    isProPackage
      ? "content-pro.html"
      : isBusinessPackage
        ? "content-business.html"
        : "content-starter.html";

  const contentPortalUrl =
    hasContentPortal &&
    contentToken
      ? `https://gdstudio360.co.uk/${contentPortalFile}?token=${encodeURIComponent(
          contentToken
        )}`
      : "";

  const completed =
    lead.status ===
    "completed";

  clientDetail.innerHTML =
    `
      <div class="detail-header">

        <div>

          <span
            class="detail-status status-${
              escapeAttr(
                categoryForLead(
                  lead
                )
              )
            }"
          >
            ${
              escapeHtml(
                prettyStatus(
                  lead.status
                )
              )
            }
          </span>

          <h2>
            ${
              escapeHtml(
                lead.business ||
                "Unnamed business"
              )
            }
          </h2>

          <p class="detail-person">
            ${
              escapeHtml(
                lead.name || ""
              )
            }
            ${
              lead.trade
                ? ` • ${escapeHtml(lead.trade)}`
                : ""
            }
          </p>

        </div>

        <div class="detail-head-actions">

          <span class="eyebrow">
            ${
              escapeHtml(
                categoryForLead(
                  lead
                ) ===
                  "progress"
                  ? "IN PROGRESS"
                  : categoryForLead(
                      lead
                    ).toUpperCase()
              )
            }
          </span>

          <div class="detail-quick-links">

            ${
              preview
                ? `
                  <a
                    class="secondary-button detail-link-button"
                    href="${escapeAttr(preview)}"
                    target="_blank"
                    rel="noopener"
                  >
                    Preview ↗
                  </a>
                `
                : ""
            }

            ${
              live
                ? `
                  <a
                    class="secondary-button detail-link-button"
                    href="${escapeAttr(live)}"
                    target="_blank"
                    rel="noopener"
                  >
                    Live site ↗
                  </a>
                `
                : ""
            }

            ${
              contentPortalUrl
                ? `
                  <a
                    class="secondary-button detail-link-button"
                    href="${escapeAttr(contentPortalUrl)}"
                    target="_blank"
                    rel="noopener"
                  >
                    Open client content portal ↗
                  </a>

                  <button
                    class="secondary-button detail-link-button"
                    id="copy-content-link"
                    type="button"
                  >
                    Copy content link
                  </button>
                `
                : ""
            }

          </div>

        </div>

      </div>

      ${workflowProgressHtml(lead)}

      <div class="detail-grid">

        <section class="detail-card">

          <h3>Client</h3>

          <div class="contact-lines">

            ${
              lead.email
                ? `
                  <a href="mailto:${
                    encodeURIComponent(
                      lead.email
                    )
                  }">
                    ${
                      escapeHtml(
                        lead.email
                      )
                    }
                  </a>
                `
                : ""
            }

            ${
              lead.phone
                ? `
                  <a href="tel:${
                    escapeAttr(
                      String(
                        lead.phone
                      )
                        .replace(
                          /[^\d+]/g,
                          ""
                        )
                    )
                  }">
                    ${
                      escapeHtml(
                        lead.phone
                      )
                    }
                  </a>
                `
                : ""
            }

            ${
              lead.area
                ? `
                  <span>
                    ${
                      escapeHtml(
                        lead.area
                      )
                    }
                  </span>
                `
                : ""
            }

            ${
              lead.attribution_source
                ? `
                  <span>
                    Source:
                    ${
                      escapeHtml(
                        lead.attribution_source
                      )
                    }

                    ${
                      lead.attribution_campaign
                        ? ` • ${escapeHtml(lead.attribution_campaign)}`
                        : ""
                    }
                  </span>
                `
                : ""
            }

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


        <section class="detail-card">

          <h3>Project links</h3>

          <div class="link-grid">

            <div class="link-box">
              <span>Preview</span>

              ${
                preview
                  ? `
                    <a
                      href="${escapeAttr(preview)}"
                      target="_blank"
                      rel="noopener"
                    >
                      Open preview ↗
                    </a>
                  `
                  : `
                    <small>
                      Not added yet
                    </small>
                  `
              }
            </div>

            <div class="link-box">
              <span>Live website</span>

              ${
                live
                  ? `
                    <a
                      href="${escapeAttr(live)}"
                      target="_blank"
                      rel="noopener"
                    >
                      Open live site ↗
                    </a>
                  `
                  : `
                    <small>
                      Not launched yet
                    </small>
                  `
              }
            </div>

            ${
              current
                ? `
                  <div class="link-box">
                    <span>
                      Previous / existing site
                    </span>

                    <a
                      href="${escapeAttr(current)}"
                      target="_blank"
                      rel="noopener"
                    >
                      Open site ↗
                    </a>
                  </div>
                `
                : ""
            }

          </div>

        </section>


        ${
          hasContentPortal
            ? `
              <section
                class="detail-card full client-content-card"
                id="client-content-card"
              >

                <div class="client-content-header">

                  <div>
                    <h3>Client Content</h3>

                    <p
                      id="client-content-status"
                      class="client-content-status"
                    >
                      Loading client content…
                    </p>
                  </div>

                  <div class="client-content-actions">

                    ${
                      contentPortalUrl
                        ? `
                          <button
                            class="secondary-button"
                            id="refresh-client-content"
                            type="button"
                          >
                            Refresh
                          </button>

                          <button
                            class="secondary-button"
                            id="copy-all-client-text"
                            type="button"
                          >
                            Copy all text
                          </button>

                          <button
                            class="primary-button"
                            id="download-all-client-content"
                            type="button"
                          >
                            Download all
                          </button>

                          <a
                            class="secondary-button"
                            href="${escapeAttr(contentPortalUrl)}"
                            target="_blank"
                            rel="noopener"
                            style="
                              display:inline-flex;
                              align-items:center;
                              text-decoration:none
                            "
                          >
                            Edit / upload ↗
                          </a>
                        `
                        : `
                          <button
                            class="primary-button"
                            id="create-content-link"
                            type="button"
                          >
                            Create content link
                          </button>
                        `
                    }

                  </div>

                </div>

                <div
                  id="client-content-body"
                  class="client-content-body"
                >
                  ${
                    contentPortalUrl
                      ? `
                        <p class="conversation-empty">
                          Loading client content…
                        </p>
                      `
                      : `
                        <p class="conversation-empty">
                          Content access link has not been created for this client yet.
                        </p>
                      `
                  }
                </div>

              </section>
            `
            : ""
        }


        <section class="detail-card full">

          <h3>Project</h3>

          <form
            id="project-form"
            class="project-form"
          >

            <div class="project-fields">

              <label>
                Package

                <select
                  id="project-package"
                  ${
                    completed
                      ? "disabled"
                      : ""
                  }
                >
                  ${
                    packageOptionsHtml(
                      lead.package
                    )
                  }
                </select>
              </label>


              <label>
                Care plan

                <select
                  id="project-care"
                  ${
                    completed
                      ? "disabled"
                      : ""
                  }
                >
                  ${
                    careOptionsHtml(
                      lead.package,
                      lead.care_plan ||
                      "No care plan"
                    )
                  }
                </select>
              </label>


              <label>
                Agreed project total (£)

                <input
                  id="project-total"
                  type="number"
                  min="0"
                  step="0.01"
                  value="${
                    projectTotal
                      ? (
                          Number(
                            projectTotal
                          ) /
                          100
                        ).toFixed(2)
                      : ""
                  }"
                  ${
                    completed
                      ? "disabled"
                      : ""
                  }
                >
              </label>


              <label>
                Price adjustment note

                <input
                  id="price-note"
                  type="text"
                  value="${
                    escapeAttr(
                      lead.price_adjustment_note ||
                      ""
                    )
                  }"
                  placeholder="e.g. Upgraded to Pro + booking form"
                  ${
                    completed
                      ? "disabled"
                      : ""
                  }
                >
              </label>


              <label class="wide">
                Preview URL

                <input
                  id="preview-url"
                  type="text"
                  value="${
                    escapeAttr(
                      lead.preview_url ||
                      ""
                    )
                  }"
                  placeholder="https://..."
                >
              </label>


              <label class="wide">
                Live website URL

                <input
                  id="live-url"
                  type="text"
                  value="${
                    escapeAttr(
                      lead.live_url ||
                      ""
                    )
                  }"
                  placeholder="https://..."
                >
              </label>

            </div>


            <div class="project-actions">

              <button
                class="primary-button"
                id="save-project"
                type="submit"
              >
                Save project details
              </button>

              <span
                id="project-save-status"
                class="reply-status"
              ></span>

            </div>

          </form>

        </section>


        <section class="detail-card full">

          <h3>Payments</h3>

          <div class="payment-summary">

            <div class="payment-stat">
              <span>PROJECT TOTAL</span>

              <strong>
                ${
                  moneyFromPence(
                    projectTotal
                  )
                }
              </strong>
            </div>


            <div class="payment-stat">
              <span>
                ${
                  depositPaid
                    ? "DEPOSIT PAID"
                    : "DEPOSIT"
                }
              </span>

              <strong>
                ${
                  depositAmount
                    ? moneyFromPence(
                        depositAmount
                      )
                    : "—"
                }
              </strong>
            </div>


            <div class="payment-stat">
              <span>
                REMAINING
              </span>

              <strong>
                ${
                  calculatedBalance !==
                  null
                    ? moneyFromPence(
                        calculatedBalance
                      )
                    : "—"
                }
              </strong>
            </div>

          </div>


          <p class="payment-note">
            ${
              lead.balance_paid_at
                ? "✓ Project paid in full."
                : lead.balance_sent_at
                  ? "Final payment request has been sent."
                  : depositPaid
                    ? "Deposit received. Build, review and launch the website before requesting the remaining balance."
                    : "Deposit has not been recorded as paid yet."
            }
          </p>


          <div
            class="payment-actions"
            id="payment-actions"
          >

            ${
              [
                "new",
                "approved"
              ].includes(
                lead.status
              )
                ? `
                  <button
                    class="primary-button"
                    id="approve-project"
                    type="button"
                  >
                    Approve & send deposit
                  </button>
                `
                : ""
            }


            ${
              lead.deposit_url &&
              !depositPaid
                ? `
                  <button
                    class="secondary-button"
                    id="copy-deposit"
                    type="button"
                  >
                    Copy deposit link
                  </button>

                  <a
                    class="secondary-button"
                    href="${
                      escapeAttr(
                        lead.deposit_url
                      )
                    }"
                    target="_blank"
                    rel="noopener"
                    style="
                      display:inline-flex;
                      align-items:center;
                      text-decoration:none
                    "
                  >
                    Open deposit ↗
                  </a>
                `
                : ""
            }


            ${
              depositPaid &&
              lead.live_url &&
              !lead.balance_paid_at &&
              [
                "review",
                "balance_due"
              ].includes(
                lead.status
              )
                ? `
                  <button
                    class="primary-button"
                    id="send-final-payment"
                    type="button"
                  >
                    ${
                      lead.status ===
                      "balance_due"
                        ? "Resend final payment"
                        : "Website launched — Send final payment"
                    }
                  </button>
                `
                : ""
            }


            ${
              lead.balance_url &&
              !lead.balance_paid_at
                ? `
                  <button
                    class="secondary-button"
                    id="copy-balance"
                    type="button"
                  >
                    Copy final payment link
                  </button>

                  <a
                    class="secondary-button"
                    href="${
                      escapeAttr(
                        lead.balance_url
                      )
                    }"
                    target="_blank"
                    rel="noopener"
                    style="
                      display:inline-flex;
                      align-items:center;
                      text-decoration:none
                    "
                  >
                    Open final payment ↗
                  </a>
                `
                : ""
            }

          </div>


          <div class="status-actions">

            ${
              lead.status ===
              "deposit_paid"
                ? `
                  <button
                    class="secondary-button"
                    id="mark-building"
                    type="button"
                  >
                    Start project
                  </button>
                `
                : ""
            }

            ${
              lead.status ===
              "building"
                ? `
                  <button
                    class="secondary-button"
                    id="mark-review"
                    type="button"
                  >
                    Send preview to client
                  </button>
                `
                : ""
            }

            ${
              lead.status ===
              "review"
                ? `
                  <button
                    class="secondary-button"
                    id="back-to-building"
                    type="button"
                  >
                    Back to building
                  </button>
                `
                : ""
            }


            ${
              lead.status ===
              "rejected"
                ? `
                  <button
                    class="secondary-button"
                    id="restore-project"
                    type="button"
                  >
                    Restore to New
                  </button>
                `
                : ""
            }


            ${
              [
                "new",
                "approved",
                "deposit_sent"
              ].includes(
                lead.status
              )
                ? `
                  <button
                    class="danger-button"
                    id="reject-project"
                    type="button"
                  >
                    Reject
                  </button>
                `
                : ""
            }


            ${
              sumupTestMode ===
              true
                ? `
                  <button
                    class="danger-button"
                    id="delete-test-client"
                    type="button"
                  >
                    Delete test client
                  </button>
                `
                : ""
            }

          </div>

        </section>


        <section class="detail-card full">

          <h3>Conversation</h3>

          <div
            id="conversation-history"
            class="conversation-history"
          >
            <p class="conversation-empty">
              Loading conversation…
            </p>
          </div>


          <form
            id="reply-form"
            class="reply-form"
          >

            <label>
              Reply

              <textarea
                id="reply-text"
                rows="4"
                maxlength="5000"
                placeholder="Write your reply..."
                required
              ></textarea>
            </label>


            <div class="reply-actions">

              <button
                class="primary-button"
                id="send-reply"
                type="submit"
              >
                Send reply
              </button>

              <span
                id="reply-status"
                class="reply-status"
              ></span>

            </div>

          </form>

        </section>

      </div>
    `;

  bindProjectControls(
    lead
  );

  if (contentPortalUrl) {
    loadClientContent(
      lead
    );
  }

  startConversationPolling(
    lead
  );
}


function getProjectFormValues(
  lead
) {
  const packageName =
    document
      .getElementById(
        "project-package"
      )
      ?.value ||
    lead.package;

  const carePlan =
    document
      .getElementById(
        "project-care"
      )
      ?.value ||
    "No care plan";

  const totalRaw =
    document
      .getElementById(
        "project-total"
      )
      ?.value;

  const totalPence =
    totalRaw === ""
      ? null
      : Math.round(
          Number(
            totalRaw
          ) *
          100
        );

  const previewRaw =
    document
      .getElementById(
        "preview-url"
      )
      ?.value ||
    "";

  const liveRaw =
    document
      .getElementById(
        "live-url"
      )
      ?.value ||
    "";

  const previewUrl =
    previewRaw.trim()
      ? normaliseUrl(
          previewRaw
        )
      : null;

  const liveUrl =
    liveRaw.trim()
      ? normaliseUrl(
          liveRaw
        )
      : null;

  if (
    previewRaw.trim() &&
    !previewUrl
  ) {
    throw new Error(
      "Preview URL is not valid."
    );
  }

  if (
    liveRaw.trim() &&
    !liveUrl
  ) {
    throw new Error(
      "Live website URL is not valid."
    );
  }

  if (
    totalPence !== null &&
    (
      !Number.isFinite(
        totalPence
      ) ||
      totalPence < 0
    )
  ) {
    throw new Error(
      "Project total is not valid."
    );
  }

  return {
    packageName,
    carePlan,
    totalPence,
    priceNote:
      document
        .getElementById(
          "price-note"
        )
        ?.value
        .trim() ||
      null,

    previewUrl,
    liveUrl
  };
}


async function saveProject(
  lead,
  options = {}
) {
  const statusEl =
    document.getElementById(
      "project-save-status"
    );

  try {
    const values =
      getProjectFormValues(
        lead
      );

    const update = {
      package:
        values.packageName,

      care_plan:
        values.carePlan,

      project_total:
        values.totalPence,

      price_adjustment_note:
        values.priceNote,

      preview_url:
        values.previewUrl,

      live_url:
        values.liveUrl
    };


    if (
      !lead.deposit_paid_at &&
      lead.deposit_amount &&
      values.totalPence &&
      [
        "approved",
        "deposit_sent"
      ].includes(
        lead.status
      )
    ) {
      update.deposit_amount =
        Math.round(
          values.totalPence /
          2
        );

      update.sumup_checkout_id =
        null;

      update.sumup_checkout_created_at =
        null;
    }


    if (
      lead.status ===
        "balance_due" &&
      lead.deposit_paid_at &&
      !lead.balance_paid_at &&
      values.totalPence
    ) {
      update.balance_amount =
        Math.max(
          values.totalPence -
          Number(
            lead.deposit_amount ||
            0
          ),
          0
        );

      update.balance_sumup_checkout_id =
        null;

      update.balance_sumup_checkout_created_at =
        null;
    }


    const { error } =
      await client
        .from("leads")
        .update(update)
        .eq(
          "id",
          lead.id
        );

    if (error) {
      throw error;
    }

    if (statusEl) {
      statusEl.textContent =
        "Saved.";
    }

    await loadLeads({
      background: true,
      refreshDetail:
        options.refreshDetail ===
        true
    });

    return true;

  } catch (error) {

    if (statusEl) {
      statusEl.textContent =
        error?.message ||
        "Could not save.";
    }

    return false;
  }
}



function clientContentApiUrl(
  packageName = ""
) {
  const key =
    String(
      packageName || ""
    )
      .trim()
      .toLowerCase();

  const functionName =
    key.startsWith(
      "pro"
    )
      ? "pro-content-portal"
      : key.startsWith(
          "business"
        )
        ? "business-content-portal"
        : "content-portal";

  return (
    `${window.GD_CONFIG.SUPABASE_URL}` +
    `/functions/v1/${functionName}`
  );
}


async function callClientContentApi(
  body,
  packageName = ""
) {
  const response =
    await fetch(
      clientContentApiUrl(
        packageName
      ),
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "apikey":
            window.GD_CONFIG
              .SUPABASE_PUBLISHABLE_KEY
        },

        body:
          JSON.stringify(body)
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data?.ok
  ) {
    throw new Error(
      data?.error ||
      "Could not load client content."
    );
  }

  return data;
}


async function uploadClientContentFile(
  token,
  slot,
  file,
  packageName = ""
) {
  const body =
    new FormData();

  body.append(
    "action",
    "upload"
  );

  body.append(
    "token",
    token
  );

  body.append(
    "slot",
    slot
  );

  body.append(
    "file",
    file
  );

  const response =
    await fetch(
      clientContentApiUrl(
        packageName
      ),
      {
        method: "POST",

        headers: {
          "apikey":
            window.GD_CONFIG
              .SUPABASE_PUBLISHABLE_KEY
        },

        body
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data?.ok
  ) {
    throw new Error(
      data?.error ||
      "Upload failed."
    );
  }

  return data;
}


function clientContentProgress(
  data
) {
  const content =
    data?.content || {};

  const files =
    data?.files || {};

  const packageKey =
    String(
      data?.package || ""
    )
      .trim()
      .toLowerCase();

  const isBusiness =
    packageKey.startsWith(
      "business"
    );

  const isPro =
    packageKey.startsWith(
      "pro"
    );

  const isAdvanced =
    isBusiness ||
    isPro;

  const services =
    Array.isArray(
      content.services
    )
      ? content.services
      : [];

  const completeServices =
    services.filter(
      item =>
        String(
          item?.name || ""
        ).trim() &&
        String(
          item?.description || ""
        ).trim()
    ).length;

  const pages =
    Array.isArray(
      content.pages
    )
      ? content.pages
      : [];

  const completePages =
    pages.filter(
      item =>
        String(
          item?.name || ""
        ).trim()
    ).length;

  const gallery =
    Array.isArray(
      files.gallery
    )
      ? files.gallery
      : [];

  const checks = [
    Boolean(
      String(
        content.business_name ||
        ""
      ).trim()
    ),

    Boolean(
      files.logo
    ),

    Boolean(
      String(
        content.hero_title ||
        ""
      ).trim()
    ),

    Boolean(
      String(
        content.hero_text ||
        ""
      ).trim()
    ),

    Boolean(
      files.hero
    ),

    Boolean(
      String(
        content.about_text ||
        ""
      ).trim()
    ),

    completeServices >= 1
  ];

  if (isAdvanced) {
    checks.push(
      completePages >= 1
    );
  }

  checks.push(
    gallery.length >= 3,

    Boolean(
      String(
        content.contact?.email ||
        ""
      ).trim()
    ),

    Boolean(
      String(
        content.contact?.area ||
        ""
      ).trim()
    )
  );

  if (isAdvanced) {
    checks.push(
      Boolean(
        String(
          content.domain?.status ||
          ""
        ).trim()
      )
    );
  }

  if (isPro) {
    const seoReady =
      Boolean(
        content.seo?.priority_services ||
        content.seo?.priority_locations ||
        content.seo?.search_phrases
      );

    checks.push(
      seoReady,
      Boolean(
        content.enquiry
          ?.primary_action
      )
    );
  }

  return Math.round(
    (
      checks.filter(Boolean).length /
      checks.length
    ) *
    100
  );
}


function clientContentText(
  data
) {
  const c =
    data?.content || {};

  const packageKey =
    String(
      data?.package || ""
    )
      .trim()
      .toLowerCase();

  const isBusiness =
    packageKey.startsWith(
      "business"
    );

  const isPro =
    packageKey.startsWith(
      "pro"
    );

  const isAdvanced =
    isBusiness ||
    isPro;

  const services =
    Array.isArray(c.services)
      ? c.services.filter(
          item =>
            item?.name ||
            item?.description
        )
      : [];

  const reviews =
    Array.isArray(c.reviews)
      ? c.reviews.filter(
          item =>
            item?.name ||
            item?.text
        )
      : [];

  const pages =
    Array.isArray(c.pages)
      ? c.pages.filter(
          item =>
            item?.name ||
            item?.notes
        )
      : [];

  const areas =
    Array.isArray(
      c.service_areas
    )
      ? c.service_areas.filter(
          item =>
            item?.name ||
            item?.notes
        )
      : [];

  const faqs =
    Array.isArray(c.faqs)
      ? c.faqs.filter(
          item =>
            item?.question ||
            item?.answer
        )
      : [];

  const lines = [
    "GD STUDIO 360 — CLIENT CONTENT",
    "",
    `Package: ${data?.package || ""}`,
    `Business: ${c.business_name || ""}`,
    "",
    "HERO",
    `Headline: ${c.hero_title || ""}`,
    `Text: ${c.hero_text || ""}`,
    "",
    "ABOUT",
    c.about_text || "",
    "",
    "SERVICES"
  ];

  services.forEach(
    (item, index) => {
      lines.push(
        "",
        `${index + 1}. ${item.name || ""}`,
        item.description || ""
      );
    }
  );

  if (isAdvanced) {
    lines.push(
      "",
      "WEBSITE PAGES"
    );

    pages.forEach(
      (item, index) => {
        lines.push(
          "",
          `${index + 1}. ${item.name || ""}${
            isPro && item.type === "service"
              ? " [Individual service page]"
              : ""
          }`,
          item.notes || ""
        );
      }
    );

    lines.push(
      "",
      "SERVICE AREAS"
    );

    areas.forEach(
      (item, index) => {
        lines.push(
          "",
          `${index + 1}. ${item.name || ""}`,
          item.notes || ""
        );
      }
    );

    lines.push(
      "",
      "FAQ"
    );

    faqs.forEach(
      (item, index) => {
        lines.push(
          "",
          `${index + 1}. ${item.question || ""}`,
          item.answer || ""
        );
      }
    );

    lines.push(
      "",
      "BRANDING",
      `Primary colour: ${c.branding?.primary_color || ""}`,
      `Secondary colour: ${c.branding?.secondary_color || ""}`,
      `Style notes: ${c.branding?.style_notes || ""}`,
      "",
      "DOMAIN",
      `Status: ${c.domain?.status || ""}`,
      `Domain: ${c.domain?.name || ""}`,
      `Registrar: ${c.domain?.registrar || ""}`,
      `Notes: ${c.domain?.notes || ""}`
    );
  }

  if (isPro) {
    lines.push(
      "",
      "SEARCH VISIBILITY",
      `Priority services: ${c.seo?.priority_services || ""}`,
      `Priority locations: ${c.seo?.priority_locations || ""}`,
      `Search phrases: ${c.seo?.search_phrases || ""}`,
      `Examples / competitors: ${c.seo?.examples || ""}`,
      "",
      "ENQUIRY FLOW",
      `Main action: ${c.enquiry?.primary_action || ""}`,
      `Destination: ${c.enquiry?.destination || ""}`,
      `Questions: ${c.enquiry?.questions || ""}`,
      `Notes: ${c.enquiry?.notes || ""}`
    );
  }

  lines.push(
    "",
    "REVIEWS"
  );

  if (!reviews.length) {
    lines.push(
      "",
      "(No reviews supplied)"
    );
  } else {
    reviews.forEach(
      (item, index) => {
        lines.push(
          "",
          `${index + 1}. ${item.name || ""}`,
          item.text || ""
        );
      }
    );
  }

  lines.push(
    "",
    "CONTACT",
    `Email: ${c.contact?.email || ""}`,
    `Phone / WhatsApp: ${c.contact?.phone || ""}`,
    `Area: ${c.contact?.area || ""}`,
    `Opening hours: ${c.contact?.hours || ""}`,
    "",
    "ONLINE PROFILES",
    `Website: ${c.socials?.website || ""}`,
    `Facebook: ${c.socials?.facebook || ""}`,
    `Instagram: ${c.socials?.instagram || ""}`
  );

  return lines.join("\n");
}


function safeDownloadName(
  value,
  fallback
) {
  const cleaned =
    String(
      value ||
      fallback ||
      "file"
    )
      .replace(
        /[^\w.\- ]+/g,
        "_"
      )
      .replace(
        /\s+/g,
        "-"
      )
      .slice(
        0,
        120
      );

  return (
    cleaned ||
    fallback ||
    "file"
  );
}


async function downloadClientFile(
  url,
  filename
) {
  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      "Could not download file."
    );
  }

  const blob =
    await response.blob();

  const objectUrl =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    objectUrl;

  link.download =
    safeDownloadName(
      filename,
      "client-file"
    );

  document.body
    .appendChild(
      link
    );

  link.click();

  link.remove();

  setTimeout(
    () => {
      URL.revokeObjectURL(
        objectUrl
      );
    },
    1000
  );
}


function clientFileCard(
  item,
  label,
  slot,
  index = null
) {
  if (
    !item ||
    !item.url
  ) {
    return `
      <div class="client-content-file">

        <div
          class="client-content-file-meta"
        >
          <strong>
            ${escapeHtml(label)}
          </strong>

          <span
            class="client-content-empty"
          >
            No file supplied
          </span>

          <label
            class="client-content-upload"
          >
            Upload

            <input
              type="file"
              data-admin-upload="${escapeAttr(slot)}"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              hidden
            >
          </label>
        </div>

      </div>
    `;
  }

  return `
    <div class="client-content-file">

      <a
        href="${escapeAttr(item.url)}"
        target="_blank"
        rel="noopener"
      >
        <img
          src="${escapeAttr(item.url)}"
          alt="${escapeAttr(label)}"
        >
      </a>

      <div
        class="client-content-file-meta"
      >

        <strong>
          ${escapeHtml(
            item.name ||
            label
          )}
        </strong>

        <div
          class="client-content-file-actions"
        >

          <a
            class="secondary-button"
            href="${escapeAttr(item.url)}"
            target="_blank"
            rel="noopener"
          >
            Preview ↗
          </a>

          <button
            class="secondary-button"
            type="button"
            data-client-download="${escapeAttr(
              item.url
            )}"
            data-client-filename="${escapeAttr(
              item.name ||
              label
            )}"
          >
            Download
          </button>

          ${
            slot !==
            "gallery"
              ? `
                <label
                  class="client-content-upload"
                >
                  Replace

                  <input
                    type="file"
                    data-admin-upload="${escapeAttr(slot)}"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    hidden
                  >
                </label>
              `
              : ""
          }

        </div>

      </div>

    </div>
  `;
}


function renderClientContent(
  lead,
  data
) {
  const body =
    document.getElementById(
      "client-content-body"
    );

  const status =
    document.getElementById(
      "client-content-status"
    );

  if (
    !body ||
    !status
  ) {
    return;
  }

  const content =
    data.content || {};

  const files =
    data.files || {};

  const services =
    Array.isArray(
      content.services
    )
      ? content.services.filter(
          item =>
            item?.name ||
            item?.description
        )
      : [];

  const reviews =
    Array.isArray(
      content.reviews
    )
      ? content.reviews.filter(
          item =>
            item?.name ||
            item?.text
        )
      : [];

  const contentPackageKey =
    String(
      data?.package ||
      lead?.package ||
      ""
    )
      .trim()
      .toLowerCase();

  const isBusinessContent =
    contentPackageKey.startsWith(
      "business"
    );

  const isProContent =
    contentPackageKey.startsWith(
      "pro"
    );

  const isAdvancedContent =
    isBusinessContent ||
    isProContent;

  const pages =
    Array.isArray(
      content.pages
    )
      ? content.pages.filter(
          item =>
            item?.name ||
            item?.notes
        )
      : [];

  const serviceAreas =
    Array.isArray(
      content.service_areas
    )
      ? content.service_areas.filter(
          item =>
            item?.name ||
            item?.notes
        )
      : [];

  const faqs =
    Array.isArray(
      content.faqs
    )
      ? content.faqs.filter(
          item =>
            item?.question ||
            item?.answer
        )
      : [];

  const gallery =
    Array.isArray(
      files.gallery
    )
      ? files.gallery
      : [];

  const galleryLimit =
    isAdvancedContent
      ? 12
      : 6;

  const percentage =
    clientContentProgress(
      data
    );

  const submitted =
    data.submitted_at
      ? new Date(
          data.submitted_at
        ).toLocaleString(
          "en-GB"
        )
      : null;

  status.textContent =
    `${percentage}% complete` +
    (
      submitted
        ? ` • Submitted ${submitted}`
        : " • Not submitted yet"
    );

  body.innerHTML = `
    <section
      class="client-content-section"
    >
      <h4>Business details</h4>

      <div class="client-content-text">
        <strong>
          ${escapeHtml(
            content.business_name ||
            "Not supplied"
          )}
        </strong>
      </div>
    </section>


    <section
      class="client-content-section"
    >
      <h4>Hero</h4>

      <div class="client-content-text">
        <strong>Headline</strong>
        <br>
        ${
          escapeHtml(
            content.hero_title ||
            "Not supplied"
          )
        }

        <br><br>

        <strong>Introduction</strong>
        <br>
        ${
          escapeHtml(
            content.hero_text ||
            "Not supplied"
          )
        }
      </div>
    </section>


    <section
      class="client-content-section"
    >
      <h4>About</h4>

      <div class="client-content-text">
        ${
          escapeHtml(
            content.about_text ||
            "Not supplied"
          )
        }
      </div>
    </section>


    <section
      class="client-content-section"
    >
      <h4>
        Services (${services.length})
      </h4>

      ${
        services.length
          ? `
            <ul
              class="client-content-list"
            >
              ${
                services
                  .map(
                    item => `
                      <li>
                        <strong>
                          ${escapeHtml(
                            item.name ||
                            "Service"
                          )}
                        </strong>

                        ${
                          item.description
                            ? `
                              <br>
                              ${escapeHtml(
                                item.description
                              )}
                            `
                            : ""
                        }
                      </li>
                    `
                  )
                  .join("")
              }
            </ul>
          `
          : `
            <span
              class="client-content-empty"
            >
              No services supplied
            </span>
          `
      }
    </section>


    ${
      isAdvancedContent
        ? `
          <section
            class="client-content-section"
          >
            <h4>
              Website pages (${pages.length})
            </h4>

            ${
              pages.length
                ? `
                  <ul class="client-content-list">
                    ${
                      pages.map(
                        item => `
                          <li>
                            <strong>
                              ${escapeHtml(
                                item.name ||
                                "Page"
                              )}
                            </strong>

                            ${
                              isProContent
                                ? `
                                  <br>
                                  <small>
                                    ${
                                      item.type === "service"
                                        ? "Individual service page"
                                        : "Standard page"
                                    }
                                  </small>
                                `
                                : ""
                            }

                            ${
                              item.notes
                                ? `
                                  <br>
                                  ${escapeHtml(
                                    item.notes
                                  )}
                                `
                                : ""
                            }
                          </li>
                        `
                      ).join("")
                    }
                  </ul>
                `
                : `
                  <span class="client-content-empty">
                    No pages supplied
                  </span>
                `
            }
          </section>


          <section
            class="client-content-section"
          >
            <h4>
              Service areas (${serviceAreas.length})
            </h4>

            ${
              serviceAreas.length
                ? `
                  <ul class="client-content-list">
                    ${
                      serviceAreas.map(
                        item => `
                          <li>
                            <strong>
                              ${escapeHtml(
                                item.name ||
                                "Area"
                              )}
                            </strong>

                            ${
                              item.notes
                                ? `
                                  <br>
                                  ${escapeHtml(
                                    item.notes
                                  )}
                                `
                                : ""
                            }
                          </li>
                        `
                      ).join("")
                    }
                  </ul>
                `
                : `
                  <span class="client-content-empty">
                    No service areas supplied
                  </span>
                `
            }
          </section>


          <section
            class="client-content-section"
          >
            <h4>
              FAQ (${faqs.length})
            </h4>

            ${
              faqs.length
                ? `
                  <ul class="client-content-list">
                    ${
                      faqs.map(
                        item => `
                          <li>
                            <strong>
                              ${escapeHtml(
                                item.question ||
                                "Question"
                              )}
                            </strong>

                            ${
                              item.answer
                                ? `
                                  <br>
                                  ${escapeHtml(
                                    item.answer
                                  )}
                                `
                                : ""
                            }
                          </li>
                        `
                      ).join("")
                    }
                  </ul>
                `
                : `
                  <span class="client-content-empty">
                    No FAQs supplied
                  </span>
                `
            }
          </section>


          <section
            class="client-content-section"
          >
            <h4>Branding</h4>

            <div class="client-content-text">
              Primary colour:
              ${escapeHtml(
                content.branding?.primary_color ||
                "—"
              )}

              <br>

              Secondary colour:
              ${escapeHtml(
                content.branding?.secondary_color ||
                "—"
              )}

              <br>

              Style notes:
              ${escapeHtml(
                content.branding?.style_notes ||
                "—"
              )}
            </div>
          </section>


          <section
            class="client-content-section"
          >
            <h4>Domain</h4>

            <div class="client-content-text">
              Status:
              ${escapeHtml(
                content.domain?.status ||
                "—"
              )}

              <br>

              Domain:
              ${escapeHtml(
                content.domain?.name ||
                "—"
              )}

              <br>

              Registrar:
              ${escapeHtml(
                content.domain?.registrar ||
                "—"
              )}

              <br>

              Notes:
              ${escapeHtml(
                content.domain?.notes ||
                "—"
              )}
            </div>
          </section>
        `
        : ""
    }


    ${
      isProContent
        ? `
          <section
            class="client-content-section"
          >
            <h4>Search visibility</h4>

            <div class="client-content-text">
              <strong>Priority services</strong>
              <br>
              ${escapeHtml(
                content.seo?.priority_services ||
                "—"
              )}

              <br><br>

              <strong>Priority locations</strong>
              <br>
              ${escapeHtml(
                content.seo?.priority_locations ||
                "—"
              )}

              <br><br>

              <strong>Customer search phrases</strong>
              <br>
              ${escapeHtml(
                content.seo?.search_phrases ||
                "—"
              )}

              <br><br>

              <strong>Examples / competitors</strong>
              <br>
              ${escapeHtml(
                content.seo?.examples ||
                "—"
              )}
            </div>
          </section>


          <section
            class="client-content-section"
          >
            <h4>Enquiry flow</h4>

            <div class="client-content-text">
              <strong>Main action</strong>
              <br>
              ${escapeHtml(
                content.enquiry?.primary_action ||
                "—"
              )}

              <br><br>

              <strong>Destination</strong>
              <br>
              ${escapeHtml(
                content.enquiry?.destination ||
                "—"
              )}

              <br><br>

              <strong>Questions to ask</strong>
              <br>
              ${escapeHtml(
                content.enquiry?.questions ||
                "—"
              )}

              <br><br>

              <strong>Notes</strong>
              <br>
              ${escapeHtml(
                content.enquiry?.notes ||
                "—"
              )}
            </div>
          </section>
        `
        : ""
    }


    <section
      class="client-content-section"
    >
      <h4>
        Reviews (${reviews.length})
      </h4>

      ${
        reviews.length
          ? `
            <ul
              class="client-content-list"
            >
              ${
                reviews
                  .map(
                    item => `
                      <li>
                        <strong>
                          ${escapeHtml(
                            item.name ||
                            "Customer"
                          )}
                        </strong>

                        ${
                          item.text
                            ? `
                              <br>
                              ${escapeHtml(
                                item.text
                              )}
                            `
                            : ""
                        }
                      </li>
                    `
                  )
                  .join("")
              }
            </ul>
          `
          : `
            <span
              class="client-content-empty"
            >
              No reviews supplied
            </span>
          `
      }
    </section>


    <section
      class="client-content-section"
    >
      <h4>Contact details</h4>

      <div class="client-content-text">
        Email:
        ${
          escapeHtml(
            content.contact?.email ||
            "—"
          )
        }

        <br>

        Phone / WhatsApp:
        ${
          escapeHtml(
            content.contact?.phone ||
            "—"
          )
        }

        <br>

        Area:
        ${
          escapeHtml(
            content.contact?.area ||
            "—"
          )
        }

        <br>

        Opening hours:
        ${
          escapeHtml(
            content.contact?.hours ||
            "—"
          )
        }
      </div>
    </section>


    <section
      class="client-content-section"
    >
      <h4>Online profiles</h4>

      <div class="client-content-text">
        Website:
        ${
          escapeHtml(
            content.socials?.website ||
            "—"
          )
        }

        <br>

        Facebook:
        ${
          escapeHtml(
            content.socials?.facebook ||
            "—"
          )
        }

        <br>

        Instagram:
        ${
          escapeHtml(
            content.socials?.instagram ||
            "—"
          )
        }
      </div>
    </section>


    <section
      class="client-content-section"
    >
      <h4>Logo</h4>

      <div class="client-content-files">
        ${
          clientFileCard(
            files.logo,
            "Logo",
            "logo"
          )
        }
      </div>
    </section>


    <section
      class="client-content-section"
    >
      <h4>Hero image</h4>

      <div class="client-content-files">
        ${
          clientFileCard(
            files.hero,
            "Hero image",
            "hero"
          )
        }
      </div>
    </section>


    <section
      class="client-content-section"
    >
      <h4>About image</h4>

      <div class="client-content-files">
        ${
          clientFileCard(
            files.about,
            "About image",
            "about"
          )
        }
      </div>
    </section>


    <section
      class="client-content-section"
    >
      <h4>
        Website photos (${gallery.length})
      </h4>

      <div class="client-content-files">

        ${
          gallery
            .map(
              (item, index) =>
                clientFileCard(
                  item,
                  `Website photo ${index + 1}`,
                  "gallery",
                  index
                )
            )
            .join("")
        }

        ${
          gallery.length < galleryLimit
            ? `
              <div
                class="client-content-file"
              >
                <div
                  class="client-content-file-meta"
                >
                  <strong>
                    Add website photo
                  </strong>

                  <label
                    class="client-content-upload"
                  >
                    Upload

                    <input
                      type="file"
                      data-admin-upload="gallery"
                      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                      hidden
                    >
                  </label>
                </div>
              </div>
            `
            : ""
        }

      </div>
    </section>
  `;


  body
    .querySelectorAll(
      "[data-client-download]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          async () => {

            button.disabled =
              true;

            try {
              await downloadClientFile(
                button.dataset
                  .clientDownload,

                button.dataset
                  .clientFilename
              );

            } catch (error) {
              dashboardStatus
                .textContent =
                  error?.message ||
                  "Download failed.";

            } finally {
              button.disabled =
                false;
            }
          }
        );
      }
    );


  body
    .querySelectorAll(
      "[data-admin-upload]"
    )
    .forEach(
      input => {
        input.addEventListener(
          "change",
          async () => {

            const file =
              input.files?.[0];

            if (!file) {
              return;
            }

            const slot =
              input.dataset
                .adminUpload;

            dashboardStatus
              .textContent =
                `Uploading ${file.name}…`;

            try {
              await uploadClientContentFile(
                lead.content_token,
                slot,
                file,
                lead.package
              );

              dashboardStatus
                .textContent =
                  "Client content updated.";

              await loadClientContent(
                lead
              );

            } catch (error) {
              dashboardStatus
                .textContent =
                  error?.message ||
                  "Upload failed.";
            }
          }
        );
      }
    );


  const copyButton =
    document.getElementById(
      "copy-all-client-text"
    );

  if (copyButton) {
    copyButton.onclick =
      async () => {
        await navigator
          .clipboard
          .writeText(
            clientContentText(
              data
            )
          );

        copyButton.textContent =
          "Copied ✓";

        setTimeout(
          () => {
            copyButton.textContent =
              "Copy all text";
          },
          1400
        );
      };
  }


  const refreshButton =
    document.getElementById(
      "refresh-client-content"
    );

  if (refreshButton) {
    refreshButton.onclick =
      () =>
        loadClientContent(
          lead
        );
  }


  const downloadAllButton =
    document.getElementById(
      "download-all-client-content"
    );

  if (downloadAllButton) {
    downloadAllButton.onclick =
      async () => {

        if (
          typeof JSZip ===
          "undefined"
        ) {
          dashboardStatus.textContent =
            "ZIP library did not load.";

          return;
        }

        downloadAllButton.disabled =
          true;

        downloadAllButton
          .textContent =
            "Preparing ZIP…";

        try {
          const zip =
            new JSZip();

          zip.file(
            "content.txt",
            clientContentText(
              data
            )
          );

          zip.file(
            "content.json",
            JSON.stringify(
              {
                package:
                  data.package,

                client_name:
                  data.client_name,

                business:
                  data.business,

                submitted_at:
                  data.submitted_at,

                content:
                  data.content
              },
              null,
              2
            )
          );

          const jobs = [];


          const addZipFile =
            (
              folderName,
              item,
              fallback
            ) => {

              if (
                !item?.url
              ) {
                return;
              }

              jobs.push(
                (
                  async () => {

                    const response =
                      await fetch(
                        item.url
                      );

                    if (
                      !response.ok
                    ) {
                      throw new Error(
                        `Could not download ${fallback}.`
                      );
                    }

                    const blob =
                      await response.blob();

                    zip
                      .folder(
                        folderName
                      )
                      .file(
                        safeDownloadName(
                          item.name,
                          fallback
                        ),
                        blob
                      );
                  }
                )()
              );
            };


          addZipFile(
            "logo",
            files.logo,
            "logo"
          );

          addZipFile(
            "hero",
            files.hero,
            "hero-image"
          );

          addZipFile(
            "about",
            files.about,
            "about-image"
          );

          gallery.forEach(
            (item, index) => {
              addZipFile(
                "website-photos",
                item,
                `photo-${String(
                  index + 1
                ).padStart(
                  2,
                  "0"
                )}`
              );
            }
          );


          await Promise.all(
            jobs
          );


          const blob =
            await zip.generateAsync(
              {
                type: "blob",

                compression:
                  "STORE"
              }
            );


          const url =
            URL.createObjectURL(
              blob
            );

          const link =
            document.createElement(
              "a"
            );

          const projectName =
            safeDownloadName(
              content.business_name ||
              lead.business ||
              "client",
              "client"
            );

          link.href =
            url;

          link.download =
            `${projectName}-content.zip`;

          document.body
            .appendChild(
              link
            );

          link.click();

          link.remove();


          setTimeout(
            () => {
              URL.revokeObjectURL(
                url
              );
            },
            1500
          );


          dashboardStatus
            .textContent =
              "Client content downloaded.";

        } catch (error) {
          dashboardStatus
            .textContent =
              error?.message ||
              "Could not create ZIP.";

        } finally {
          downloadAllButton.disabled =
            false;

          downloadAllButton
            .textContent =
              "Download all";
        }
      };
  }
}


async function loadClientContent(
  lead
) {
  const body =
    document.getElementById(
      "client-content-body"
    );

  const status =
    document.getElementById(
      "client-content-status"
    );

  if (
    !body ||
    !status ||
    !lead?.content_token
  ) {
    return;
  }

  status.textContent =
    "Loading client content…";

  try {
    const data =
      await callClientContentApi(
        {
          action:
            "load",

          token:
            lead.content_token
        },
        lead.package
      );

    renderClientContent(
      lead,
      data
    );

  } catch (error) {
    status.textContent =
      "Could not load client content.";

    body.innerHTML = `
      <p class="conversation-empty">
        ${
          escapeHtml(
            error?.message ||
            "Unknown error."
          )
        }
      </p>
    `;
  }
}


function bindProjectControls(
  lead
) {
  const projectForm =
    document.getElementById(
      "project-form"
    );

  const packageSelect =
    document.getElementById(
      "project-package"
    );

  const careSelect =
    document.getElementById(
      "project-care"
    );

  const totalInput =
    document.getElementById(
      "project-total"
    );


  document
    .getElementById(
      "copy-content-link"
    )
    ?.addEventListener(
      "click",
      async (event) => {

        const packageKey =
          String(
            lead.package || ""
          )
            .trim()
            .toLowerCase();

        const portalFile =
          packageKey.startsWith(
            "pro"
          )
            ? "content-pro.html"
            : packageKey.startsWith(
                "business"
              )
              ? "content-business.html"
              : packageKey.startsWith(
                  "starter"
                )
                ? "content-starter.html"
                : "";

        if (
          !lead.content_token ||
          !portalFile
        ) {
          return;
        }

        const url =
          `https://gdstudio360.co.uk/${portalFile}?token=${encodeURIComponent(
            lead.content_token
          )}`;

        await navigator
          .clipboard
          .writeText(url);

        event.currentTarget
          .textContent =
            "Copied ✓";

        dashboardStatus.textContent =
          "Content link copied.";

        setTimeout(
          () => {
            event.currentTarget
              .textContent =
                "Copy content link";
          },
          1400
        );
      }
    );


  document
    .getElementById(
      "create-content-link"
    )
    ?.addEventListener(
      "click",
      async (event) => {

        event.currentTarget.disabled =
          true;

        dashboardStatus.textContent =
          "Creating content access…";

        const newToken =
          crypto.randomUUID();

        const {
          error
        } =
          await client
            .from("leads")
            .update({
              content_token:
                newToken
            })
            .eq(
              "id",
              lead.id
            );

        if (error) {
          dashboardStatus.textContent =
            error.message;

          event.currentTarget.disabled =
            false;

          return;
        }

        dashboardStatus.textContent =
          "Content access created.";

        await loadLeads({
          background: true,
          refreshDetail: true
        });
      }
    );


  let previousPackage =
    lead.package;


  packageSelect
    ?.addEventListener(
      "change",
      () => {
        const oldPrice =
          packagePrice(
            previousPackage
          );

        const newPrice =
          packagePrice(
            packageSelect.value
          );

        const currentPence =
          totalInput?.value
            ? Math.round(
                Number(
                  totalInput.value
                ) *
                100
              )
            : null;

        if (
          newPrice &&
          (
            currentPence ===
              oldPrice ||
            !lead.project_total
          )
        ) {
          totalInput.value =
            (
              newPrice /
              100
            ).toFixed(2);
        }

        const care =
          CARE_BY_PACKAGE[
            packageSelect.value
          ];

        careSelect.innerHTML =
          `
            <option value="No care plan">
              No care plan
            </option>

            ${
              care
                ? `
                  <option value="${escapeAttr(care)}">
                    ${escapeHtml(care)}
                  </option>
                `
                : ""
            }
          `;

        previousPackage =
          packageSelect.value;
      }
    );


  projectForm
    ?.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        await saveProject(
          lead,
          {
            refreshDetail: true
          }
        );
      }
    );


  document
    .getElementById(
      "approve-project"
    )
    ?.addEventListener(
      "click",
      async () => {
        const saved =
          await saveProject(
            lead
          );

        if (!saved) {
          return;
        }

        const freshLead =
          getLeadById(
            lead.id
          ) || lead;

        const selectedPackage =
          document
            .getElementById(
              "project-package"
            )
            ?.value ||
          freshLead.package;

        if (
          !PACKAGE_TOTALS[
            selectedPackage
          ]
        ) {
          dashboardStatus.textContent =
            "Choose Starter, Business or Pro first.";

          return;
        }

        const total =
          document
            .getElementById(
              "project-total"
            )
            ?.value;

        if (
          !total ||
          Number(total) <= 0
        ) {
          dashboardStatus.textContent =
            "Enter the agreed project total first.";

          return;
        }

        dashboardStatus.textContent =
          "Creating deposit request…";

        const {
          data,
          error
        } =
          await client.functions
            .invoke(
              "approve-lead",
              {
                body: {
                  lead_id:
                    lead.id
                }
              }
            );

        if (
          error ||
          !data?.ok
        ) {
          dashboardStatus.textContent =
            data?.error ||
            error?.message ||
            "Could not approve project.";

          return;
        }

        dashboardStatus.textContent =
          data.email_sent
            ? "Deposit request created and emailed."
            : "Deposit request created.";

        await loadLeads({
          refreshDetail: true
        });
      }
    );


  document
    .getElementById(
      "copy-deposit"
    )
    ?.addEventListener(
      "click",
      async (event) => {
        await navigator
          .clipboard
          .writeText(
            lead.deposit_url
          );

        event.currentTarget
          .textContent =
            "Copied";

        setTimeout(
          () => {
            event.currentTarget
              .textContent =
                "Copy deposit link";
          },
          1200
        );
      }
    );


  document
    .getElementById(
      "send-final-payment"
    )
    ?.addEventListener(
      "click",
      async () => {
        const saved =
          await saveProject(
            lead
          );

        if (!saved) {
          return;
        }

        const ok =
          confirm(
            "Send the remaining balance payment request to this client?"
          );

        if (!ok) {
          return;
        }

        dashboardStatus.textContent =
          "Creating final payment request…";

        const {
          data,
          error
        } =
          await client.functions
            .invoke(
              "send-final-payment",
              {
                body: {
                  lead_id:
                    lead.id
                }
              }
            );

        if (
          error ||
          !data?.ok
        ) {
          dashboardStatus.textContent =
            data?.error ||
            error?.message ||
            "Could not create final payment request.";

          return;
        }

        dashboardStatus.textContent =
          data.email_sent
            ? `Final payment ${moneyFromPence(data.balance_amount)} sent to client.`
            : `Final payment ${moneyFromPence(data.balance_amount)} created.`;

        await loadLeads({
          refreshDetail: true
        });
      }
    );


  document
    .getElementById(
      "copy-balance"
    )
    ?.addEventListener(
      "click",
      async (event) => {
        await navigator
          .clipboard
          .writeText(
            lead.balance_url
          );

        event.currentTarget
          .textContent =
            "Copied";

        setTimeout(
          () => {
            event.currentTarget
              .textContent =
                "Copy final payment link";
          },
          1200
        );
      }
    );


  document
    .getElementById(
      "mark-building"
    )
    ?.addEventListener(
      "click",
      () =>
        updateLeadStatus(
          lead.id,
          "building"
        )
    );


  document
    .getElementById(
      "mark-review"
    )
    ?.addEventListener(
      "click",
      async () => {
        const saved =
          await saveProject(
            lead
          );

        if (!saved) {
          return;
        }

        const freshLead =
          getLeadById(
            lead.id
          ) || lead;

        if (
          !freshLead.preview_url
        ) {
          dashboardStatus.textContent =
            "Add the Preview URL before sending it to the client.";

          return;
        }

        const ok =
          confirm(
            `Send the website preview to ${freshLead.email}?`
          );

        if (!ok) {
          return;
        }

        dashboardStatus.textContent =
          "Sending website preview…";

        const {
          data,
          error
        } =
          await client.functions
            .invoke(
              "admin-inbox",
              {
                body: {
                  action:
                    "send_preview",

                  lead_id:
                    lead.id
                }
              }
            );

        if (
          error ||
          !data?.ok
        ) {
          dashboardStatus.textContent =
            data?.error ||
            error?.message ||
            "Could not send website preview.";

          return;
        }

        dashboardStatus.textContent =
          "Website preview sent to client.";

        await loadLeads({
          refreshDetail: true
        });
      }
    );


  document
    .getElementById(
      "back-to-building"
    )
    ?.addEventListener(
      "click",
      () =>
        updateLeadStatus(
          lead.id,
          "building"
        )
    );


  document
    .getElementById(
      "restore-project"
    )
    ?.addEventListener(
      "click",
      async () => {
        const ok =
          confirm(
            `Restore ${lead.business} to New?`
          );

        if (!ok) {
          return;
        }

        await updateLeadStatus(
          lead.id,
          "new"
        );
      }
    );


  document
    .getElementById(
      "reject-project"
    )
    ?.addEventListener(
      "click",
      async () => {
        const ok =
          confirm(
            `Reject ${lead.business}?`
          );

        if (!ok) {
          return;
        }

        await updateLeadStatus(
          lead.id,
          "rejected"
        );
      }
    );


  document
    .getElementById(
      "delete-test-client"
    )
    ?.addEventListener(
      "click",
      async () => {
        if (
          sumupTestMode !==
          true
        ) {
          dashboardStatus.textContent =
            "Test client deletion is only available in SUMUP TEST MODE.";

          return;
        }

        const business =
          lead.business ||
          lead.name ||
          "this client";

        const confirmation =
          prompt(
            `Permanently delete test client "${business}" and its conversation?\n\nType DELETE to confirm.`
          );

        if (
          confirmation !==
          "DELETE"
        ) {
          return;
        }

        const button =
          document.getElementById(
            "delete-test-client"
          );

        if (button) {
          button.disabled =
            true;

          button.textContent =
            "Deleting…";
        }

        dashboardStatus.textContent =
          `Deleting test client ${business}…`;

        stopConversationPolling();

        const {
          data,
          error
        } =
          await client.functions
            .invoke(
              "delete-test-client",
              {
                body: {
                  lead_id:
                    lead.id
                }
              }
            );

        if (
          error ||
          !data?.ok
        ) {
          dashboardStatus.textContent =
            data?.error ||
            error?.message ||
            "Could not delete test client.";

          if (button) {
            button.disabled =
              false;

            button.textContent =
              "Delete test client";
          }

          startConversationPolling(
            lead
          );

          return;
        }

        selectedLeadId =
          null;

        dashboardStatus.textContent =
          `Test client ${business} deleted.`;

        await loadLeads({
          refreshDetail:
            true
        });
      }
    );
}


async function updateLeadStatus(
  id,
  status
) {
  const { error } =
    await client
      .from("leads")
      .update({
        status
      })
      .eq(
        "id",
        id
      );

  if (error) {
    dashboardStatus.textContent =
      error.message;

    return;
  }

  dashboardStatus.textContent =
    `Status changed to ${prettyStatus(status)}.`;

  await loadLeads({
    refreshDetail: true
  });
}


function stopConversationPolling() {
  if (
    conversationTimer
  ) {
    clearInterval(
      conversationTimer
    );

    conversationTimer =
      null;
  }

  conversationLeadId =
    null;

  conversationMessageIds =
    new Set();
}


function appendConversationMessage(
  message
) {
  const history =
    document.getElementById(
      "conversation-history"
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
    document.createElement(
      "div"
    );

  bubble.className =
    `conversation-message role-${message.role}`;

  const labels = {
    customer:
      "Customer",
    assistant:
      "AI Assistant",
    human:
      "You",
    system:
      "System"
  };

  const content =
    message.role ===
    "customer"
      ? cleanCustomerReply(
          message.content
        )
      : String(
          message.content ||
          ""
        );

  bubble.innerHTML =
    `
      <div class="conversation-message-meta">

        <strong>
          ${
            escapeHtml(
              labels[
                message.role
              ] ||
              message.role
            )
          }
        </strong>

        <span>
          ${
            message.created_at
              ? escapeHtml(
                  new Date(
                    message.created_at
                  )
                    .toLocaleString(
                      "en-GB"
                    )
                )
              : ""
          }
        </span>

      </div>

      <p>
        ${escapeHtml(content)}
      </p>

      <small>
        ${
          escapeHtml(
            message.channel ||
            ""
          )
        }
      </small>
    `;

  history
    .appendChild(
      bubble
    );

  if (message.id) {
    conversationMessageIds
      .add(
        String(
          message.id
        )
      );
  }
}


async function loadConversation(
  lead
) {
  if (
    !lead ||
    String(
      selectedLeadId
    ) !==
    String(
      lead.id
    )
  ) {
    return;
  }

  const history =
    document.getElementById(
      "conversation-history"
    );

  if (!history) {
    return;
  }

  const {
    data,
    error
  } =
    await client.functions
      .invoke(
        "admin-inbox",
        {
          body: {
            action:
              "history",
            lead_id:
              lead.id
          }
        }
      );

  if (
    error ||
    !data?.ok
  ) {
    history.innerHTML =
      `
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
    Array.isArray(
      data.messages
    )
      ? data.messages
      : [];


  if (
    conversationLeadId !==
    lead.id
  ) {
    conversationLeadId =
      lead.id;

    conversationMessageIds =
      new Set();

    history.innerHTML =
      "";
  }


  const newItems =
    items.filter(
      (message) =>
        !conversationMessageIds
          .has(
            String(
              message.id
            )
          )
    );


  if (
    !items.length &&
    !history.children.length
  ) {
    history.innerHTML =
      `
        <p class="conversation-empty">
          No conversation history yet.
        </p>
      `;

    return;
  }


  const wasNearBottom =
    (
      history.scrollHeight -
      history.scrollTop -
      history.clientHeight
    ) < 80;


  for (
    const message of newItems
  ) {
    appendConversationMessage(
      message
    );
  }


  if (wasNearBottom) {
    history.scrollTop =
      history.scrollHeight;
  }
}


function startConversationPolling(
  lead
) {
  conversationLeadId =
    lead.id;

  conversationMessageIds =
    new Set();

  loadConversation(
    lead
  );


  const replyForm =
    document.getElementById(
      "reply-form"
    );

  const replyText =
    document.getElementById(
      "reply-text"
    );

  const replyStatus =
    document.getElementById(
      "reply-status"
    );

  const sendButton =
    document.getElementById(
      "send-reply"
    );


  replyForm
    ?.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        const message =
          replyText.value
            .trim();

        if (!message) {
          return;
        }

        sendButton.disabled =
          true;

        sendButton.textContent =
          "Sending…";

        replyStatus.textContent =
          "Sending…";

        const {
          data,
          error
        } =
          await client.functions
            .invoke(
              "admin-inbox",
              {
                body: {
                  action:
                    "send",

                  lead_id:
                    lead.id,

                  message
                }
              }
            );

        if (
          error ||
          !data?.ok
        ) {
          replyStatus.textContent =
            data?.error ||
            error?.message ||
            "Could not send reply.";

          sendButton.disabled =
            false;

          sendButton.textContent =
            "Send reply";

          return;
        }

        replyText.value =
          "";

        replyStatus.textContent =
          "Reply sent.";

        sendButton.disabled =
          false;

        sendButton.textContent =
          "Send reply";

        await loadConversation(
          lead
        );
      }
    );


  conversationTimer =
    setInterval(
      () => {
        if (
          !document.hidden &&
          String(
            selectedLeadId
          ) ===
          String(
            lead.id
          )
        ) {
          loadConversation(
            lead
          );
        }
      },
      3000
    );
}


function updatePendingBanner() {
  if (
    pendingNewCount < 1
  ) {
    pendingBanner.hidden =
      true;

    pendingBanner.textContent =
      "";

    return;
  }

  pendingBanner.hidden =
    false;

  pendingBanner.textContent =
    pendingNewCount === 1
      ? "1 new enquiry received — Open New"
      : `${pendingNewCount} new enquiries received — Open New`;
}


pendingBanner
  ?.addEventListener(
    "click",
    () => {
      pendingNewCount = 0;
      updatePendingBanner();

      activeView =
        "new";

      updateActiveTab();

      const first =
        visibleLeads()[0];

      if (first) {
        selectedLeadId =
          first.id;
      }

      renderClientList();
      renderSelectedLead();
    }
  );


function updateActiveTab() {
  document
    .querySelectorAll(
      ".crm-tab"
    )
    .forEach(
      (button) => {
        button.classList
          .toggle(
            "active",
            button.dataset.view ===
            activeView
          );
      }
    );
}


document
  .querySelectorAll(
    ".crm-tab"
  )
  .forEach(
    (button) => {
      button
        .addEventListener(
          "click",
          () => {
            activeView =
              button.dataset.view;

            updateActiveTab();

            const first =
              visibleLeads()[0];

            selectedLeadId =
              first
                ? first.id
                : null;

            renderClientList();
            renderSelectedLead();
          }
        );
    }
  );


searchInput
  ?.addEventListener(
    "input",
    () => {
      const rows =
        visibleLeads();

      const selectedStillVisible =
        rows.some(
          (lead) =>
            String(lead.id) ===
            String(selectedLeadId)
        );

      let selectionChanged =
        false;

      if (!selectedStillVisible) {
        selectedLeadId =
          rows[0]?.id || null;

        selectionChanged =
          true;
      }

      renderClientList();

      if (selectionChanged) {
        renderSelectedLead();
      }

      const query =
        searchInput.value
          .trim();

      if (query) {
        dashboardStatus.textContent =
          `${rows.length} search result${
            rows.length === 1 ? "" : "s"
          } across all client lists`;
      } else {
        dashboardStatus.textContent =
          `${leads.length} clients • Live`;
      }
    }
  );


sortSelect
  ?.addEventListener(
    "change",
    () => {
      renderClientList();
    }
  );


document.addEventListener(
  "keydown",
  (event) => {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();

      searchInput?.focus();
      searchInput?.select();

      return;
    }

    if (
      event.key === "Escape" &&
      document.activeElement === searchInput &&
      searchInput?.value
    ) {
      searchInput.value = "";

      const rows =
        visibleLeads();

      selectedLeadId =
        rows[0]?.id || null;

      renderClientList();
      renderSelectedLead();

      dashboardStatus.textContent =
        `${leads.length} clients • Live`;
    }
  }
);



function crmDetailHasUnsavedWork() {
  const reply =
    document.getElementById(
      "reply-text"
    );

  if (
    reply &&
    reply.value.trim()
  ) {
    return true;
  }

  const projectForm =
    document.getElementById(
      "project-form"
    );

  if (
    projectForm &&
    projectForm.contains(
      document.activeElement
    )
  ) {
    return true;
  }

  return false;
}


function refreshSelectedDetailIfSafe() {
  if (
    !selectedLeadId
  ) {
    return;
  }

  if (
    crmDetailHasUnsavedWork()
  ) {
    dashboardStatus.textContent =
      "Client updated in the background. Finish or save your current edit to refresh the details.";

    return;
  }

  renderSelectedLead();
}

function startRealtime() {
  if (
    !client ||
    realtimeChannel
  ) {
    return;
  }

  realtimeChannel =
    client
      .channel(
        "crm-leads-live"
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leads"
        },
        async (payload) => {

          if (
            payload
              ?.eventType ===
              "INSERT" &&
            payload
              ?.new
              ?.status ===
              "new"
          ) {
            pendingNewCount +=
              1;

            updatePendingBanner();
          }

          const changedLeadId =
            payload?.new?.id ||
            payload?.old?.id ||
            null;

          await loadLeads({
            background: true
          });

          if (
            changedLeadId &&
            String(changedLeadId) ===
            String(selectedLeadId)
          ) {
            refreshSelectedDetailIfSafe();
          }
        }
      )
      .subscribe(
        (status) => {
          if (
            status ===
            "SUBSCRIBED"
          ) {
            dashboardStatus.textContent =
              `${leads.length} clients • Live`;
          }
        }
      );
}


function stopRealtime() {
  if (
    client &&
    realtimeChannel
  ) {
    client.removeChannel(
      realtimeChannel
    );
  }

  realtimeChannel =
    null;
}


document
  .addEventListener(
    "visibilitychange",
    () => {
      if (
        !document.hidden &&
        dashboardView &&
        !dashboardView.hidden
      ) {
        loadLeads({
          background: true
        }).then(() => {
          refreshSelectedDetailIfSafe();
        });
      }
    }
  );


ensureSession();
