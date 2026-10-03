const cfg =
  window.GD_CONFIG || {};

const params =
  new URLSearchParams(
    window.location.search
  );

const token =
  params.get("token") || "";

const demoMode =
  params.get("demo") === "1";

const form =
  document.getElementById(
    "content-form"
  );

const message =
  document.getElementById(
    "portal-message"
  );

const saveStatus =
  document.getElementById(
    "save-status"
  );

const saveButton =
  document.getElementById(
    "save-button"
  );

const submitButton =
  document.getElementById(
    "submit-button"
  );

let portalFiles = {
  logo: null,
  hero: null,
  about: null,
  gallery: []
};

let submittedAt = null;

let serviceFieldCount = 1;
let reviewFieldCount = 1;
let pageFieldCount = 1;
let serviceAreaFieldCount = 1;
let faqFieldCount = 1;


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function showMessage(
  text,
  visible = true
) {
  message.textContent =
    text;

  message.hidden =
    !visible;
}


function lastMeaningfulIndex(
  items,
  fields
) {
  let count = 0;

  items.forEach(
    (item, index) => {
      const hasContent =
        fields.some(
          field =>
            String(
              item?.[field] || ""
            ).trim()
        );

      if (hasContent) {
        count = index + 1;
      }
    }
  );

  return count;
}


function renderServices(
  items = [],
  requestedCount = null
) {
  const target =
    document.getElementById(
      "services-list"
    );

  const source =
    Array.isArray(items)
      ? items.slice(0, 10)
      : [];

  const savedCount =
    lastMeaningfulIndex(
      source,
      [
        "name",
        "description"
      ]
    );

  serviceFieldCount =
    Math.min(
      10,
      Math.max(
        1,
        requestedCount ??
        savedCount ??
        1
      )
    );

  target.innerHTML =
    Array.from(
      {
        length:
          serviceFieldCount
      },
      (_, index) => {
        const item =
          source[index] || {};

        return `
          <div class="service-item">

            <div class="repeatable-head">

              <h3>
                Service ${index + 1}
              </h3>

              ${
                index > 0
                  ? `
                    <button
                      type="button"
                      class="small-action"
                      data-remove-service="${index}"
                    >
                      Remove
                    </button>
                  `
                  : ""
              }

            </div>

            <label>
              Service name

              <input
                id="service-name-${index}"
                maxlength="100"
                placeholder="Service name"
                value="${escapeHtml(
                  item?.name || ""
                )}"
              >
            </label>

            <label>
              Short description

              <textarea
                id="service-description-${index}"
                rows="3"
                maxlength="500"
                placeholder="Briefly explain this service."
              >${escapeHtml(
                item?.description || ""
              )}</textarea>
            </label>

          </div>
        `;
      }
    ).join("") +
    (
      serviceFieldCount < 10
        ? `
          <button
            type="button"
            id="add-service"
            class="add-item-button"
          >
            + Add another service
          </button>
        `
        : `
          <p class="field-note">
            Maximum 10 services reached.
          </p>
        `
    );

  target
    .querySelector(
      "#add-service"
    )
    ?.addEventListener(
      "click",
      () => {
        const current =
          collectServices();

        renderServices(
          current,
          serviceFieldCount + 1
        );

        calculateProgress();
      }
    );

  target
    .querySelectorAll(
      "[data-remove-service]"
    )
    .forEach(
      button => {
        button
          .addEventListener(
            "click",
            () => {
              const current =
                collectServices();

              const index =
                Number(
                  button.dataset
                    .removeService
                );

              current.splice(
                index,
                1
              );

              renderServices(
                current,
                Math.max(
                  1,
                  serviceFieldCount - 1
                )
              );

              calculateProgress();

              if (!demoMode) {
                saveStatus.textContent =
                  "Unsaved changes";
              }
            }
          );
      }
    );
}


function createServices() {
  renderServices(
    [],
    1
  );
}


function renderReviews(
  items = [],
  requestedCount = null
) {
  const target =
    document.getElementById(
      "reviews-list"
    );

  const source =
    Array.isArray(items)
      ? items.slice()
      : [];

  const savedCount =
    lastMeaningfulIndex(
      source,
      [
        "name",
        "text"
      ]
    );

  reviewFieldCount =
    Math.max(
      1,
      requestedCount ??
      savedCount ??
      1
    );

  target.innerHTML =
    Array.from(
      {
        length:
          reviewFieldCount
      },
      (_, index) => {
        const item =
          source[index] || {};

        return `
          <div class="review-item">

            <div class="repeatable-head">

              <h3>
                Review ${index + 1}
                — optional
              </h3>

              ${
                index > 0
                  ? `
                    <button
                      type="button"
                      class="small-action"
                      data-remove-review="${index}"
                    >
                      Remove
                    </button>
                  `
                  : ""
              }

            </div>

            <label>
              Customer name

              <input
                id="review-name-${index}"
                maxlength="100"
                placeholder="Customer name"
                value="${escapeHtml(
                  item?.name || ""
                )}"
              >
            </label>

            <label>
              Review

              <textarea
                id="review-text-${index}"
                rows="4"
                maxlength="800"
                placeholder="Paste the genuine customer review here."
              >${escapeHtml(
                item?.text || ""
              )}</textarea>
            </label>

          </div>
        `;
      }
    ).join("") +
    `
      <button
        type="button"
        id="add-review"
        class="add-item-button"
      >
        + Add another review
      </button>
    `;

  target
    .querySelector(
      "#add-review"
    )
    ?.addEventListener(
      "click",
      () => {
        const current =
          collectReviews();

        renderReviews(
          current,
          reviewFieldCount + 1
        );
      }
    );

  target
    .querySelectorAll(
      "[data-remove-review]"
    )
    .forEach(
      button => {
        button
          .addEventListener(
            "click",
            () => {
              const current =
                collectReviews();

              const index =
                Number(
                  button.dataset
                    .removeReview
                );

              current.splice(
                index,
                1
              );

              renderReviews(
                current,
                Math.max(
                  1,
                  reviewFieldCount - 1
                )
              );

              if (!demoMode) {
                saveStatus.textContent =
                  "Unsaved changes";
              }
            }
          );
      }
    );
}


function createReviews() {
  renderReviews(
    [],
    1
  );
}



function renderPages(
  items = [],
  requestedCount = null
) {
  const target =
    document.getElementById(
      "pages-list"
    );

  const source =
    Array.isArray(items)
      ? items.slice(0, 8)
      : [];

  const savedCount =
    lastMeaningfulIndex(
      source,
      ["name", "notes"]
    );

  pageFieldCount =
    Math.min(
      8,
      Math.max(
        1,
        requestedCount ??
        savedCount ??
        1
      )
    );

  target.innerHTML =
    Array.from(
      { length: pageFieldCount },
      (_, index) => {
        const item =
          source[index] || {};

        return `
          <div class="business-repeatable-item">

            <div class="repeatable-head">

              <h3>
                Page ${index + 1}
              </h3>

              ${
                index > 0
                  ? `
                    <button
                      type="button"
                      class="small-action"
                      data-remove-page="${index}"
                    >
                      Remove
                    </button>
                  `
                  : ""
              }

            </div>

            <label>
              Page name

              <input
                id="page-name-${index}"
                maxlength="100"
                placeholder="Example: Home, About, Services..."
                value="${escapeHtml(
                  item?.name || ""
                )}"
              >
            </label>

            <label>
              Page type

              <select
                id="page-type-${index}"
              >
                <option
                  value="standard"
                  ${
                    item?.type === "service"
                      ? ""
                      : "selected"
                  }
                >
                  Standard page
                </option>

                <option
                  value="service"
                  ${
                    item?.type === "service"
                      ? "selected"
                      : ""
                  }
                >
                  Individual service page
                </option>
              </select>
            </label>

            <label>
              What should this page include?

              <textarea
                id="page-notes-${index}"
                rows="3"
                maxlength="1200"
                placeholder="Describe what you want customers to see on this page."
              >${escapeHtml(
                item?.notes || ""
              )}</textarea>
            </label>

          </div>
        `;
      }
    ).join("") +
    (
      pageFieldCount < 8
        ? `
          <button
            type="button"
            id="add-page"
            class="add-item-button"
          >
            + Add another page
          </button>
        `
        : `
          <p class="field-note">
            Maximum 8 pages reached.
          </p>
        `
    );

  target
    .querySelector("#add-page")
    ?.addEventListener(
      "click",
      () => {
        const current =
          collectPages();

        renderPages(
          current,
          pageFieldCount + 1
        );

        calculateProgress();
      }
    );

  target
    .querySelectorAll(
      "[data-remove-page]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const current =
              collectPages();

            const index =
              Number(
                button.dataset
                  .removePage
              );

            current.splice(
              index,
              1
            );

            renderPages(
              current,
              Math.max(
                1,
                pageFieldCount - 1
              )
            );

            calculateProgress();

            if (!demoMode) {
              saveStatus.textContent =
                "Unsaved changes";
            }
          }
        );
      }
    );
}


function renderServiceAreas(
  items = [],
  requestedCount = null
) {
  const target =
    document.getElementById(
      "service-areas-list"
    );

  const source =
    Array.isArray(items)
      ? items.slice(0, 10)
      : [];

  const savedCount =
    lastMeaningfulIndex(
      source,
      ["name", "notes"]
    );

  serviceAreaFieldCount =
    Math.min(
      10,
      Math.max(
        1,
        requestedCount ??
        savedCount ??
        1
      )
    );

  target.innerHTML =
    Array.from(
      {
        length:
          serviceAreaFieldCount
      },
      (_, index) => {
        const item =
          source[index] || {};

        return `
          <div class="business-repeatable-item">

            <div class="repeatable-head">

              <h3>
                Area ${index + 1}
              </h3>

              ${
                index > 0
                  ? `
                    <button
                      type="button"
                      class="small-action"
                      data-remove-area="${index}"
                    >
                      Remove
                    </button>
                  `
                  : ""
              }

            </div>

            <label>
              Town / city / service area

              <input
                id="service-area-name-${index}"
                maxlength="120"
                placeholder="Example: Ipswich"
                value="${escapeHtml(
                  item?.name || ""
                )}"
              >
            </label>

            <label>
              Notes — optional

              <textarea
                id="service-area-notes-${index}"
                rows="2"
                maxlength="800"
                placeholder="Anything specific about this area."
              >${escapeHtml(
                item?.notes || ""
              )}</textarea>
            </label>

          </div>
        `;
      }
    ).join("") +
    (
      serviceAreaFieldCount < 10
        ? `
          <button
            type="button"
            id="add-service-area"
            class="add-item-button"
          >
            + Add another service area
          </button>
        `
        : `
          <p class="field-note">
            Maximum 10 service areas reached.
          </p>
        `
    );

  target
    .querySelector(
      "#add-service-area"
    )
    ?.addEventListener(
      "click",
      () => {
        const current =
          collectServiceAreas();

        renderServiceAreas(
          current,
          serviceAreaFieldCount + 1
        );
      }
    );

  target
    .querySelectorAll(
      "[data-remove-area]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const current =
              collectServiceAreas();

            const index =
              Number(
                button.dataset
                  .removeArea
              );

            current.splice(
              index,
              1
            );

            renderServiceAreas(
              current,
              Math.max(
                1,
                serviceAreaFieldCount - 1
              )
            );

            if (!demoMode) {
              saveStatus.textContent =
                "Unsaved changes";
            }
          }
        );
      }
    );
}


function renderFaqs(
  items = [],
  requestedCount = null
) {
  const target =
    document.getElementById(
      "faqs-list"
    );

  const source =
    Array.isArray(items)
      ? items.slice(0, 8)
      : [];

  const savedCount =
    lastMeaningfulIndex(
      source,
      ["question", "answer"]
    );

  faqFieldCount =
    Math.min(
      8,
      Math.max(
        1,
        requestedCount ??
        savedCount ??
        1
      )
    );

  target.innerHTML =
    Array.from(
      { length: faqFieldCount },
      (_, index) => {
        const item =
          source[index] || {};

        return `
          <div class="business-repeatable-item">

            <div class="repeatable-head">

              <h3>
                FAQ ${index + 1}
                — optional
              </h3>

              ${
                index > 0
                  ? `
                    <button
                      type="button"
                      class="small-action"
                      data-remove-faq="${index}"
                    >
                      Remove
                    </button>
                  `
                  : ""
              }

            </div>

            <label>
              Question

              <input
                id="faq-question-${index}"
                maxlength="250"
                placeholder="Example: Do you offer free quotes?"
                value="${escapeHtml(
                  item?.question || ""
                )}"
              >
            </label>

            <label>
              Answer

              <textarea
                id="faq-answer-${index}"
                rows="3"
                maxlength="1200"
                placeholder="Write the answer here."
              >${escapeHtml(
                item?.answer || ""
              )}</textarea>
            </label>

          </div>
        `;
      }
    ).join("") +
    (
      faqFieldCount < 8
        ? `
          <button
            type="button"
            id="add-faq"
            class="add-item-button"
          >
            + Add another FAQ
          </button>
        `
        : `
          <p class="field-note">
            Maximum 8 FAQs reached.
          </p>
        `
    );

  target
    .querySelector("#add-faq")
    ?.addEventListener(
      "click",
      () => {
        const current =
          collectFaqs();

        renderFaqs(
          current,
          faqFieldCount + 1
        );
      }
    );

  target
    .querySelectorAll(
      "[data-remove-faq]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const current =
              collectFaqs();

            const index =
              Number(
                button.dataset
                  .removeFaq
              );

            current.splice(
              index,
              1
            );

            renderFaqs(
              current,
              Math.max(
                1,
                faqFieldCount - 1
              )
            );

            if (!demoMode) {
              saveStatus.textContent =
                "Unsaved changes";
            }
          }
        );
      }
    );
}


function collectPages() {
  return Array.from(
    { length: pageFieldCount },
    (_, index) => ({
      name:
        document
          .getElementById(
            `page-name-${index}`
          )
          ?.value
          .trim() || "",

      type:
        document
          .getElementById(
            `page-type-${index}`
          )
          ?.value ||
        "standard",

      notes:
        document
          .getElementById(
            `page-notes-${index}`
          )
          ?.value
          .trim() || ""
    })
  );
}


function collectServiceAreas() {
  return Array.from(
    {
      length:
        serviceAreaFieldCount
    },
    (_, index) => ({
      name:
        document
          .getElementById(
            `service-area-name-${index}`
          )
          ?.value
          .trim() || "",

      notes:
        document
          .getElementById(
            `service-area-notes-${index}`
          )
          ?.value
          .trim() || ""
    })
  );
}


function collectFaqs() {
  return Array.from(
    { length: faqFieldCount },
    (_, index) => ({
      question:
        document
          .getElementById(
            `faq-question-${index}`
          )
          ?.value
          .trim() || "",

      answer:
        document
          .getElementById(
            `faq-answer-${index}`
          )
          ?.value
          .trim() || ""
    })
  );
}


function createPages() {
  renderPages([], 1);
}


function createServiceAreas() {
  renderServiceAreas([], 1);
}


function createFaqs() {
  renderFaqs([], 1);
}


function collectServices() {
  return Array.from(
    {
      length:
        serviceFieldCount
    },
    (_, index) => ({
      name:
        document
          .getElementById(
            `service-name-${index}`
          )
          ?.value
          .trim() || "",

      description:
        document
          .getElementById(
            `service-description-${index}`
          )
          ?.value
          .trim() || ""
    })
  );
}


function collectReviews() {
  return Array.from(
    {
      length:
        reviewFieldCount
    },
    (_, index) => ({
      name:
        document
          .getElementById(
            `review-name-${index}`
          )
          ?.value
          .trim() || "",

      text:
        document
          .getElementById(
            `review-text-${index}`
          )
          ?.value
          .trim() || ""
    })
  );
}


function collectContent() {
  return {
    business_name:
      document
        .getElementById(
          "business-name"
        )
        .value
        .trim(),

    hero_title:
      document
        .getElementById(
          "hero-title"
        )
        .value
        .trim(),

    hero_text:
      document
        .getElementById(
          "hero-text"
        )
        .value
        .trim(),

    about_text:
      document
        .getElementById(
          "about-text"
        )
        .value
        .trim(),

    services:
      collectServices(),

    reviews:
      collectReviews(),

    pages:
      collectPages(),

    service_areas:
      collectServiceAreas(),

    faqs:
      collectFaqs(),

    branding: {
      primary_color:
        document
          .getElementById(
            "branding-primary"
          )
          .value
          .trim(),

      secondary_color:
        document
          .getElementById(
            "branding-secondary"
          )
          .value
          .trim(),

      style_notes:
        document
          .getElementById(
            "branding-style"
          )
          .value
          .trim()
    },

    domain: {
      status:
        document
          .getElementById(
            "domain-status"
          )
          .value
          .trim(),

      name:
        document
          .getElementById(
            "domain-name"
          )
          .value
          .trim(),

      registrar:
        document
          .getElementById(
            "domain-registrar"
          )
          .value
          .trim(),

      notes:
        document
          .getElementById(
            "domain-notes"
          )
          .value
          .trim()
    },

    seo: {
      priority_services:
        document
          .getElementById("seo-priority-services")
          .value
          .trim(),

      priority_locations:
        document
          .getElementById("seo-priority-locations")
          .value
          .trim(),

      search_phrases:
        document
          .getElementById("seo-search-phrases")
          .value
          .trim(),

      examples:
        document
          .getElementById("seo-examples")
          .value
          .trim()
    },

    enquiry: {
      primary_action:
        document
          .getElementById("enquiry-primary-action")
          .value
          .trim(),

      destination:
        document
          .getElementById("enquiry-destination")
          .value
          .trim(),

      questions:
        document
          .getElementById("enquiry-questions")
          .value
          .trim(),

      notes:
        document
          .getElementById("enquiry-notes")
          .value
          .trim()
    },

    contact: {
      email:
        document
          .getElementById(
            "contact-email"
          )
          .value
          .trim(),

      phone:
        document
          .getElementById(
            "contact-phone"
          )
          .value
          .trim(),

      area:
        document
          .getElementById(
            "contact-area"
          )
          .value
          .trim(),

      hours:
        document
          .getElementById(
            "contact-hours"
          )
          .value
          .trim()
    },

    socials: {
      website:
        document
          .getElementById(
            "social-website"
          )
          .value
          .trim(),

      facebook:
        document
          .getElementById(
            "social-facebook"
          )
          .value
          .trim(),

      instagram:
        document
          .getElementById(
            "social-instagram"
          )
          .value
          .trim()
    }
  };
}


function calculateProgress() {
  const data =
    collectContent();

  const serviceCount =
    data.services
      .filter(
        item =>
          item.name &&
          item.description
      )
      .length;

  const pageCount =
    data.pages
      .filter(
        item =>
          item.name
      )
      .length;

  const seoReady =
    Boolean(
      data.seo?.priority_services ||
      data.seo?.priority_locations ||
      data.seo?.search_phrases
    );

  const checks = [
    Boolean(data.business_name),
    Boolean(portalFiles.logo),
    Boolean(data.hero_title),
    Boolean(data.hero_text),
    Boolean(portalFiles.hero),
    Boolean(data.about_text),
    serviceCount >= 1,
    pageCount >= 1,
    portalFiles.gallery.length >= 3,
    Boolean(data.contact.email),
    Boolean(data.contact.area),
    Boolean(data.domain.status),
    seoReady,
    Boolean(
      data.enquiry?.primary_action
    )
  ];

  const done =
    checks.filter(Boolean)
      .length;

  const percentage =
    Math.round(
      (
        done /
        checks.length
      ) * 100
    );

  document
    .getElementById(
      "progress-bar"
    )
    .style.width =
      `${percentage}%`;

  document
    .getElementById(
      "progress-text"
    )
    .textContent =
      `${percentage}% complete`;

  return percentage;
}


async function callApi(body) {
  if (
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_PUBLISHABLE_KEY
  ) {
    throw new Error(
      "Content portal is not connected."
    );
  }

  const response =
    await fetch(
      `${cfg.SUPABASE_URL}/functions/v1/pro-content-portal`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "apikey":
            cfg.SUPABASE_PUBLISHABLE_KEY
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
      "Request failed."
    );
  }

  return data;
}


async function uploadApi(
  formData
) {
  const response =
    await fetch(
      `${cfg.SUPABASE_URL}/functions/v1/pro-content-portal`,
      {
        method: "POST",

        headers: {
          "apikey":
            cfg.SUPABASE_PUBLISHABLE_KEY
        },

        body:
          formData
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


function fillForm(
  content = {}
) {
  document
    .getElementById(
      "business-name"
    )
    .value =
      content.business_name ||
      "";

  document
    .getElementById(
      "hero-title"
    )
    .value =
      content.hero_title ||
      "";

  document
    .getElementById(
      "hero-text"
    )
    .value =
      content.hero_text ||
      "";

  document
    .getElementById(
      "about-text"
    )
    .value =
      content.about_text ||
      "";

  const services =
    Array.isArray(
      content.services
    )
      ? content.services
      : [];

  renderServices(
    services
  );


  const reviews =
    Array.isArray(
      content.reviews
    )
      ? content.reviews
      : [];

  renderReviews(
    reviews
  );


  renderPages(
    Array.isArray(
      content.pages
    )
      ? content.pages
      : []
  );


  renderServiceAreas(
    Array.isArray(
      content.service_areas
    )
      ? content.service_areas
      : []
  );


  renderFaqs(
    Array.isArray(
      content.faqs
    )
      ? content.faqs
      : []
  );


  document
    .getElementById(
      "branding-primary"
    )
    .value =
      content.branding
        ?.primary_color ||
      "";

  document
    .getElementById(
      "branding-secondary"
    )
    .value =
      content.branding
        ?.secondary_color ||
      "";

  document
    .getElementById(
      "branding-style"
    )
    .value =
      content.branding
        ?.style_notes ||
      "";

  document
    .getElementById(
      "domain-status"
    )
    .value =
      content.domain?.status ||
      "";

  document
    .getElementById(
      "domain-name"
    )
    .value =
      content.domain?.name ||
      "";

  document
    .getElementById(
      "domain-registrar"
    )
    .value =
      content.domain
        ?.registrar ||
      "";

  document
    .getElementById(
      "domain-notes"
    )
    .value =
      content.domain?.notes ||
      "";


  document
    .getElementById(
      "seo-priority-services"
    )
    .value =
      content.seo?.priority_services || "";

  document
    .getElementById(
      "seo-priority-locations"
    )
    .value =
      content.seo?.priority_locations || "";

  document
    .getElementById(
      "seo-search-phrases"
    )
    .value =
      content.seo?.search_phrases || "";

  document
    .getElementById(
      "seo-examples"
    )
    .value =
      content.seo?.examples || "";

  document
    .getElementById(
      "enquiry-primary-action"
    )
    .value =
      content.enquiry?.primary_action || "";

  document
    .getElementById(
      "enquiry-destination"
    )
    .value =
      content.enquiry?.destination || "";

  document
    .getElementById(
      "enquiry-questions"
    )
    .value =
      content.enquiry?.questions || "";

  document
    .getElementById(
      "enquiry-notes"
    )
    .value =
      content.enquiry?.notes || "";


  document
    .getElementById(
      "contact-email"
    )
    .value =
      content.contact?.email ||
      "";

  document
    .getElementById(
      "contact-phone"
    )
    .value =
      content.contact?.phone ||
      "";

  document
    .getElementById(
      "contact-area"
    )
    .value =
      content.contact?.area ||
      "";

  document
    .getElementById(
      "contact-hours"
    )
    .value =
      content.contact?.hours ||
      "";

  document
    .getElementById(
      "social-website"
    )
    .value =
      content.socials?.website ||
      "";

  document
    .getElementById(
      "social-facebook"
    )
    .value =
      content.socials?.facebook ||
      "";

  document
    .getElementById(
      "social-instagram"
    )
    .value =
      content.socials?.instagram ||
      "";
}


function fileCard(
  item,
  slot,
  index = null
) {
  if (
    !item ||
    !item.url
  ) {
    return "";
  }

  return `
    <div class="file-card">

      <img
        src="${escapeHtml(item.url)}"
        alt=""
      >

      <div class="file-info">

        <span>
          ${escapeHtml(
            item.name ||
            "Uploaded image"
          )}
        </span>

        <button
          type="button"
          class="remove-file"
          data-remove-slot="${escapeHtml(slot)}"
          ${
            index !== null
              ? `data-remove-index="${index}"`
              : ""
          }
        >
          Remove
        </button>

      </div>

    </div>
  `;
}


function renderFiles() {
  document
    .getElementById(
      "logo-preview"
    )
    .innerHTML =
      fileCard(
        portalFiles.logo,
        "logo"
      );

  document
    .getElementById(
      "hero-preview"
    )
    .innerHTML =
      fileCard(
        portalFiles.hero,
        "hero"
      );

  document
    .getElementById(
      "about-preview"
    )
    .innerHTML =
      fileCard(
        portalFiles.about,
        "about"
      );

  document
    .getElementById(
      "gallery-preview"
    )
    .innerHTML =
      portalFiles.gallery
        .map(
          (item, index) =>
            fileCard(
              item,
              "gallery",
              index
            )
        )
        .join("");

  bindRemoveButtons();

  calculateProgress();
}


async function saveDraft(
  options = {}
) {
  const silent =
    options.silent === true;

  if (demoMode) {
    if (!silent) {
      saveStatus.textContent =
        "Demo mode — changes are not saved.";
    }

    return true;
  }

  try {
    saveButton.disabled =
      true;

    if (!silent) {
      saveStatus.textContent =
        "Saving…";
    }

    const data =
      await callApi({
        action: "save",
        token,
        content:
          collectContent()
      });

    if (
      data?.submitted_at
    ) {
      submittedAt =
        data.submitted_at;
    }

    if (!silent) {
      saveStatus.textContent =
        "Saved ✓";
    }

    return true;

  } catch (error) {
    saveStatus.textContent =
      error?.message ||
      "Could not save.";

    return false;

  } finally {
    saveButton.disabled =
      false;
  }
}


async function uploadFile(
  file,
  slot
) {
  if (demoMode) {
    showMessage(
      "File upload is disabled in demo mode."
    );

    return;
  }

  if (!file) {
    return;
  }

  await saveDraft({
    silent: true
  });

  showMessage(
    `Uploading ${file.name}…`
  );

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

  await uploadApi(
    body
  );

  await loadPortal({
    quiet: true
  });

  showMessage(
    "Image uploaded ✓"
  );
}


function bindRemoveButtons() {
  document
    .querySelectorAll(
      "[data-remove-slot]"
    )
    .forEach(
      button => {

        button
          .addEventListener(
            "click",
            async () => {

              if (demoMode) {
                showMessage(
                  "Remove is disabled in demo mode."
                );

                return;
              }

              button.disabled =
                true;

              try {
                await callApi({
                  action:
                    "remove_file",

                  token,

                  slot:
                    button.dataset
                      .removeSlot,

                  index:
                    button.dataset
                      .removeIndex !==
                    undefined
                      ? Number(
                          button.dataset
                            .removeIndex
                        )
                      : null
                });

                await loadPortal({
                  quiet: true
                });

                showMessage(
                  "Image removed."
                );

              } catch (error) {
                showMessage(
                  error?.message ||
                  "Could not remove image."
                );

              } finally {
                button.disabled =
                  false;
              }
            }
          );
      }
    );
}


async function loadPortal(
  options = {}
) {
  const quiet =
    options.quiet === true;

  if (demoMode) {
    fillForm({});

    showMessage(
      "Preview mode — this is how the Pro Content Portal will look to a client."
    );

    calculateProgress();

    return;
  }

  if (!token) {
    form.hidden =
      true;

    showMessage(
      "This content portal link is incomplete."
    );

    return;
  }

  try {
    if (!quiet) {
      showMessage(
        "Loading your project…"
      );
    }

    const data =
      await callApi({
        action: "load",
        token
      });

    portalFiles = {
      logo:
        data.files?.logo ||
        null,

      hero:
        data.files?.hero ||
        null,

      about:
        data.files?.about ||
        null,

      gallery:
        Array.isArray(
          data.files?.gallery
        )
          ? data.files.gallery
          : []
    };

    submittedAt =
      data.submitted_at ||
      null;

    fillForm(
      data.content ||
      {}
    );

    renderFiles();

    if (submittedAt) {
      showMessage(
        "Your content has already been submitted. You can still update it using this private link."
      );

    } else if (!quiet) {
      showMessage(
        `Welcome${
          data.client_name
            ? `, ${data.client_name}`
            : ""
        }. Your progress is saved to this private project link.`
      );
    }

  } catch (error) {
    form.hidden =
      true;

    showMessage(
      error?.message ||
      "Could not open this content portal."
    );
  }
}


/* ==============================
   BUILD FORM
============================== */

createServices();
createReviews();
createPages();
createServiceAreas();
createFaqs();


/* ==============================
   PROGRESS
============================== */

form
  .addEventListener(
    "input",
    () => {

      calculateProgress();

      if (!demoMode) {
        saveStatus.textContent =
          "Unsaved changes";
      }
    }
  );


/* ==============================
   LOGO / HERO / ABOUT UPLOADS
============================== */

document
  .querySelectorAll(
    "[data-upload-slot]"
  )
  .forEach(
    input => {

      input
        .addEventListener(
          "change",
          async () => {

            const file =
              input.files?.[0];

            if (!file) {
              return;
            }

            try {
              await uploadFile(
                file,
                input.dataset
                  .uploadSlot
              );

            } catch (error) {
              showMessage(
                error?.message ||
                "Upload failed."
              );
            }

            input.value =
              "";
          }
        );
    }
  );


/* ==============================
   GALLERY UPLOAD
============================== */

document
  .getElementById(
    "gallery-upload"
  )
  .addEventListener(
    "change",
    async event => {

      const files =
        Array.from(
          event.target.files ||
          []
        );

      for (
        const file of files
      ) {

        if (
          portalFiles
            .gallery
            .length >= 12
        ) {
          showMessage(
            "Business package allows up to 12 gallery images."
          );

          break;
        }

        try {
          await uploadFile(
            file,
            "gallery"
          );

        } catch (error) {
          showMessage(
            error?.message ||
            "Upload failed."
          );

          break;
        }
      }

      event.target.value =
        "";
    }
  );


/* ==============================
   SAVE
============================== */

saveButton
  .addEventListener(
    "click",
    async () => {

      await saveDraft();

      calculateProgress();
    }
  );


/* ==============================
   SUBMIT
============================== */

submitButton
  .addEventListener(
    "click",
    async () => {

      if (demoMode) {
        showMessage(
          "Demo mode — content was not submitted."
        );

        return;
      }

      const percentage =
        calculateProgress();

      if (
        percentage < 70
      ) {
        const proceed =
          confirm(
            `Your content is ${percentage}% complete. Submit it anyway?`
          );

        if (!proceed) {
          return;
        }
      }

      submitButton.disabled =
        true;

      saveStatus.textContent =
        "Submitting…";

      try {
        const data =
          await callApi({
            action:
              "submit",

            token,

            content:
              collectContent()
          });

        submittedAt =
          data.submitted_at;

        saveStatus.textContent =
          "Submitted ✓";

        showMessage(
          "Thank you. Your website content has been submitted to GD Studio 360."
        );

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });

      } catch (error) {
        saveStatus.textContent =
          error?.message ||
          "Could not submit.";

      } finally {
        submitButton.disabled =
          false;
      }
    }
  );


/* ==============================
   START PORTAL
============================== */

loadPortal();
