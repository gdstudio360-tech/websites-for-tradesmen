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


function createServices() {
  const target =
    document.getElementById(
      "services-list"
    );

  target.innerHTML =
    Array.from(
      { length: 6 },
      (_, index) => `
        <div class="service-item">

          <h3>
            Service ${index + 1}
            ${
              index < 3
                ? ""
                : " — optional"
            }
          </h3>

          <label>
            Service name

            <input
              id="service-name-${index}"
              maxlength="100"
              placeholder="Service name"
            >
          </label>

          <label>
            Short description

            <textarea
              id="service-description-${index}"
              rows="3"
              maxlength="500"
              placeholder="Briefly explain this service."
            ></textarea>
          </label>

        </div>
      `
    ).join("");
}


function createReviews() {
  const target =
    document.getElementById(
      "reviews-list"
    );

  target.innerHTML =
    Array.from(
      { length: 3 },
      (_, index) => `
        <div class="review-item">

          <h3>
            Review ${index + 1}
            — optional
          </h3>

          <label>
            Customer name

            <input
              id="review-name-${index}"
              maxlength="100"
              placeholder="Customer name"
            >
          </label>

          <label>
            Review

            <textarea
              id="review-text-${index}"
              rows="4"
              maxlength="800"
              placeholder="Paste the genuine customer review here."
            ></textarea>
          </label>

        </div>
      `
    ).join("");
}


function collectServices() {
  return Array.from(
    { length: 6 },
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
    { length: 3 },
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

  const checks = [
    Boolean(data.business_name),
    Boolean(portalFiles.logo),
    Boolean(data.hero_title),
    Boolean(data.hero_text),
    Boolean(portalFiles.hero),
    Boolean(data.about_text),
    serviceCount >= 3,
    portalFiles.gallery.length >= 3,
    Boolean(data.contact.email),
    Boolean(data.contact.area)
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
      `${cfg.SUPABASE_URL}/functions/v1/content-portal`,
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
      `${cfg.SUPABASE_URL}/functions/v1/content-portal`,
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

  services
    .slice(0, 6)
    .forEach(
      (item, index) => {

        document
          .getElementById(
            `service-name-${index}`
          )
          .value =
            item?.name ||
            "";

        document
          .getElementById(
            `service-description-${index}`
          )
          .value =
            item?.description ||
            "";
      }
    );

  const reviews =
    Array.isArray(
      content.reviews
    )
      ? content.reviews
      : [];

  reviews
    .slice(0, 3)
    .forEach(
      (item, index) => {

        document
          .getElementById(
            `review-name-${index}`
          )
          .value =
            item?.name ||
            "";

        document
          .getElementById(
            `review-text-${index}`
          )
          .value =
            item?.text ||
            "";
      }
    );

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
    fillForm({
      business_name:
        "Your Business"
    });

    showMessage(
      "Preview mode — this is how the Starter Content Portal will look to a client."
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
            .length >= 6
        ) {
          showMessage(
            "Starter package allows up to 6 gallery images."
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
