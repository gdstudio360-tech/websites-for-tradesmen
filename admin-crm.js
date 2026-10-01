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
  status
) {
  const map = {
    new: 0,
    approved: 1,
    deposit_sent: 1,
    deposit_paid: 2,
    building: 2,
    review: 3,
    balance_due: 4,
    completed: 5
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
    "Final payment",
    "Complete"
  ];

  const current =
    workflowStepIndex(
      lead.status
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

    await loadLeads({
      refreshDetail: true
    });

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

      await loadLeads({
        refreshDetail: true
      });

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
          activeView === "all" ||
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

  if (!rows.length) {
    clientList.innerHTML =
      `
        <div style="
          padding:18px;
          color:#687386;
          font-size:.8rem
        ">
          No clients in this list.
        </div>
      `;

    return;
  }

  for (
    const lead of rows
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


    button.innerHTML =
      `
        <div class="client-row-top">

          <span class="client-row-business">
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


        <span class="client-row-person">
          ${
            escapeHtml(
              lead.name || ""
            )
          }
        </span>


        <span class="client-row-bottom">

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


    button
      .addEventListener(
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
            draft.value
              .trim()
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

    clientList
      .appendChild(
        wrapper
      );
  }
}


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

  const paidSoFar =
    depositPaid
      ? depositAmount
      : 0;

  const calculatedBalance =
    projectTotal
      ? Math.max(
          Number(
            projectTotal
          ) -
          paidSoFar,
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
                    ? "Deposit received. The remaining amount will be collected when the client approves the finished website."
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
              !lead.balance_paid_at &&
              ![
                "rejected",
                "completed"
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
                        : "Client approved — Send final payment"
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
