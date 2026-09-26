const menuButton = document.querySelector(".menu-button");
const nav = document.querySelector(".primary-nav");

if (menuButton && nav) {
  menuButton.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
}

document.querySelectorAll(".faq-list details").forEach((item) => {
  item.addEventListener("toggle", () => {
    if (!item.open) return;
    document.querySelectorAll(".faq-list details").forEach((other) => {
      if (other !== item) other.open = false;
    });
  });
});

const year = document.getElementById("year");
if (year) year.textContent = new Date().getFullYear();

/*
  Contact details are assembled in JavaScript so they are not displayed
  as plain text in the HTML page. This reduces simple scraping, but no
  public website can make contact details impossible for determined bots to discover.
*/
const contact = {
  phone: ["+44", "7561", "430471"].join(""),
  email: ["gdstudio360", "@", "gmail.com"].join("")
};

const callButton = document.getElementById("contact-call");
const whatsappButton = document.getElementById("contact-whatsapp");
const emailButton = document.getElementById("contact-email");

if (callButton) {
  callButton.href = `tel:${contact.phone}`;
}

if (emailButton) {
  emailButton.href = `mailto:${contact.email}`;
}

if (whatsappButton) {
  const whatsappNumber = contact.phone.replace(/\D/g, "");
  const message = encodeURIComponent(
    "Hi, I’m interested in a website for my trade business. I’d like to know more."
  );
  // This opens a WhatsApp text chat with a pre-filled message. It does not initiate a WhatsApp call.
  whatsappButton.href = `https://wa.me/${whatsappNumber}?text=${message}`;
}

/*
  REAL CONTACT FORM SETUP
  -----------------------
  1. Create a Formspree form.
  2. Copy its form ID, e.g. "xabcdefg".
  3. Paste the ID below in place of PASTE_FORMSPREE_FORM_ID_HERE.

  The Formspree form ID does not expose your destination email address.
*/
const FORMSPREE_FORM_ID = "mjykeaej";


// Package selection: carry the visitor's pricing choice into the enquiry form.
const packageSelect = document.getElementById("lead-package");
const selectedPackageBox = document.getElementById("selected-package");
const selectedPackageName = document.getElementById("selected-package-name");
const changePackageButton = document.getElementById("change-package");
const packageField = document.getElementById("package-field");
const carePlanSelect = document.getElementById("lead-care-plan");
const careField = document.getElementById("care-field");
const careFormNote = document.getElementById("care-form-note");

const CARE_BY_PACKAGE = {
  "Starter — £249": {
    value: "Website Care — £29/month",
    label: "Website + Starter Care — £29/month"
  },
  "Business — £399": {
    value: "Business Care — £59/month",
    label: "Website + Business Care — £59/month"
  },
  "Pro — £599": {
    value: "Pro Care — £99/month",
    label: "Website + Pro Care — £99/month"
  }
};

function refreshCareOptions(packageName, preferredValue = "No care plan") {
  if (!carePlanSelect) return;

  const care = CARE_BY_PACKAGE[packageName];
  carePlanSelect.innerHTML = "";

  const websiteOnly = document.createElement("option");
  websiteOnly.value = "No care plan";
  websiteOnly.textContent = "Website only — no monthly care plan";
  carePlanSelect.appendChild(websiteOnly);

  if (care) {
    const withCare = document.createElement("option");
    withCare.value = care.value;
    withCare.textContent = care.label;
    carePlanSelect.appendChild(withCare);

    if (careFormNote) {
      careFormNote.textContent =
        "Care starts after launch. It covers the maintenance allowance shown for this website package.";
    }
  } else if (careFormNote) {
    careFormNote.textContent =
      "Choose a website package first. Its matching care option will appear here.";
  }

  carePlanSelect.value =
    Array.from(carePlanSelect.options).some((item) => item.value === preferredValue)
      ? preferredValue
      : "No care plan";
}

function updateSelectedCare(carePlan) {
  if (!carePlanSelect) return;
  const option = Array.from(carePlanSelect.options).find((item) => item.value === carePlan);
  carePlanSelect.value = option ? carePlan : "No care plan";
}

function updateSelectedPackage(packageName, showSummary = true) {
  if (!packageSelect) return;

  const matchingOption = Array.from(packageSelect.options).find(
    (option) => option.value === packageName
  );

  if (matchingOption) {
    packageSelect.value = packageName;
  }

  if (selectedPackageBox && selectedPackageName) {
    const isSpecificPackage =
      packageName && packageName !== "Not sure — recommend one";

    selectedPackageBox.hidden = !(showSummary && isSpecificPackage);

    if (isSpecificPackage) {
      selectedPackageName.textContent = packageName;
    }
  }
}

document.querySelectorAll(".package-select-button").forEach((button) => {
  button.addEventListener("click", () => {
    const packageName = button.dataset.package;
    const careChoice =
      button.closest(".price-card")?.querySelector('input[type="radio"]:checked')?.value ||
      "No care plan";

    updateSelectedPackage(packageName, true);
    refreshCareOptions(packageName, careChoice);
  });
});

document.querySelectorAll(".care-select-button").forEach((button) => {
  button.addEventListener("click", () => {
    const packageName = button.dataset.package;
    updateSelectedPackage(packageName, true);
    refreshCareOptions(packageName, button.dataset.care || "No care plan");
    careField?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
});

if (packageSelect) {
  packageSelect.addEventListener("change", () => {
    updateSelectedPackage(packageSelect.value, true);
    refreshCareOptions(packageSelect.value, "No care plan");
  });
}

refreshCareOptions(packageSelect?.value || "Not sure — recommend one", "No care plan");

if (changePackageButton && packageField && packageSelect) {
  changePackageButton.addEventListener("click", () => {
    packageField.scrollIntoView({ behavior: "smooth", block: "center" });
    packageSelect.focus();
  });
}



const gdConfig = window.GD_CONFIG || {};
const gdSupabase =
  window.supabase &&
  gdConfig.SUPABASE_URL &&
  gdConfig.SUPABASE_PUBLISHABLE_KEY
    ? window.supabase.createClient(
        gdConfig.SUPABASE_URL,
        gdConfig.SUPABASE_PUBLISHABLE_KEY
      )
    : null;

async function saveLeadToDashboard(formData) {
  if (!gdSupabase) return { skipped: true };

  const packageValue = String(formData.get("package") || "Not sure — recommend one");
  const payload = {
    name: String(formData.get("name") || "").trim(),
    business: String(formData.get("business") || "").trim(),
    trade: String(formData.get("trade") || "").trim(),
    area: String(formData.get("area") || "").trim(),
    email: String(formData.get("email") || "").trim(),
    phone: String(formData.get("phone") || "").trim() || null,
    current_site: String(formData.get("currentSite") || "").trim() || null,
    package: packageValue,
    care_plan: String(formData.get("care_plan") || "No care plan"),
    message: String(formData.get("message") || "").trim() || null,
    terms_accepted: formData.get("termsAccepted") === "on",
    status: "new"
  };

  const { error } = await gdSupabase.from("leads").insert(payload);
  if (error) throw error;
  return { skipped: false };
}


const form = document.getElementById("lead-form");
const formStatus = document.getElementById("form-status");
const submitButton = document.getElementById("lead-submit");

function setFormStatus(message, type = "") {
  if (!formStatus) return;
  formStatus.textContent = message;
  formStatus.className = `form-status ${type}`.trim();
}

if (form) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (
      !FORMSPREE_FORM_ID ||
      FORMSPREE_FORM_ID === "PASTE_FORMSPREE_FORM_ID_HERE"
    ) {
      setFormStatus(
        "The enquiry form is being connected. Please use WhatsApp or email for now.",
        "error"
      );
      return;
    }

    const originalLabel = submitButton
      ? submitButton.querySelector(".submit-label")?.textContent
      : "";

    if (submitButton) {
      submitButton.disabled = true;
      const label = submitButton.querySelector(".submit-label");
      if (label) label.textContent = "Sending…";
    }

    setFormStatus("Sending your enquiry…", "sending");

    try {
      const formData = new FormData(form);

      const response = await fetch(
        `https://formspree.io/f/${FORMSPREE_FORM_ID}`,
        {
          method: "POST",
          body: formData,
          headers: {
            Accept: "application/json"
          }
        }
      );

      if (response.ok) {
        try {
          await saveLeadToDashboard(formData);
        } catch (dashboardError) {
          console.error("Dashboard lead sync failed:", dashboardError);
        }

        form.reset();
        updateSelectedPackage("Not sure — recommend one", false);
        refreshCareOptions("Not sure — recommend one", "No care plan");
        setFormStatus(
          "Thanks — your enquiry has been sent. We’ll review it and, if the project is a good fit, send you an approval and secure deposit link.",
          "success"
        );
      } else if (response.status === 429) {
        setFormStatus(
          "Too many attempts were sent in a short time. Please wait a little and try again.",
          "error"
        );
      } else {
        let message = "We couldn’t send your request. Please try again or use WhatsApp.";
        try {
          const data = await response.json();
          if (data?.errors?.length) {
            message = data.errors.map((item) => item.message).join(" ");
          }
        } catch (_) {}
        setFormStatus(message, "error");
      }
    } catch (_) {
      setFormStatus(
        "Connection problem. Please try again or send us a WhatsApp message.",
        "error"
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        const label = submitButton.querySelector(".submit-label");
        if (label) label.textContent = originalLabel || "Send my enquiry →";
      }
    }
  });
}
