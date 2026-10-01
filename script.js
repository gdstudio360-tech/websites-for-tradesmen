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

const whatsappButton = document.getElementById("contact-whatsapp");
const emailButton = document.getElementById("contact-email");


if (emailButton) {
  emailButton.href = `mailto:${contact.email}`;
}

if (whatsappButton) {
  const whatsappNumber = contact.phone.replace(/\D/g, "");
  const message = encodeURIComponent(
    "Hi, I’m interested in a website for my business. I’d like to know more."
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


/* GD PREMIUM MOTION START */

(() => {

  if (!document.body.classList.contains("gd-premium")) return;

  const reduced =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const header = document.querySelector(".site-header");
  const heroPreview = document.querySelector(".hero-preview");

  function scrollEffects(){

    const y = window.scrollY || 0;

    if(header){
      header.classList.toggle("gd-scrolled", y > 20);
    }

    if(heroPreview && !reduced && window.innerWidth > 980){
      heroPreview.style.transform =
        `translateY(${Math.min(y * .025, 22)}px)`;
    }

  }

  window.addEventListener(
    "scroll",
    () => requestAnimationFrame(scrollEffects),
    {passive:true}
  );

  scrollEffects();

  const selectors = [
    ".section-head",
    ".benefit",
    ".about-copy",
    ".trust-panel",
    ".demo-copy",
    ".demo-device",
    ".pricing-head",
    ".price-card",
    ".care-intro",
    ".care-explainer",
    ".care-policy-note",
    ".steps li",
    ".faq-list details",
    ".contact-copy",
    ".lead-form"
  ];

  const items =
    document.querySelectorAll(selectors.join(","));

  items.forEach((el,index) => {

    el.classList.add("gd-reveal");

    el.style.setProperty(
      "--gd-delay",
      `${(index % 4) * 75}ms`
    );

  });

  if(reduced || !("IntersectionObserver" in window)){

    items.forEach(el =>
      el.classList.add("gd-visible")
    );

    return;
  }

  const observer = new IntersectionObserver(
    entries => {

      entries.forEach(entry => {

        if(!entry.isIntersecting) return;

        entry.target.classList.add("gd-visible");

        observer.unobserve(entry.target);

      });

    },
    {
      threshold:.12,
      rootMargin:"0px 0px -45px 0px"
    }
  );

  items.forEach(el => observer.observe(el));

})();

/* GD PREMIUM MOTION END */

/* =======================================================
   REVEAL ON SCROLL
======================================================= */
(function () {
  const items = document.querySelectorAll('.reveal-on-scroll');
  if (!items.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.16 });

  items.forEach((item) => observer.observe(item));
})();


/* =======================================================
   GD STUDIO 360 AI ASSISTANT
======================================================= */

(() => {
  const root = document.getElementById("gd-chat");
  const launcher = document.getElementById("gd-chat-launcher");
  const panel = document.getElementById("gd-chat-panel");
  const closeButton = document.getElementById("gd-chat-close");
  const newChatButton = document.getElementById("gd-chat-new");
  const messages = document.getElementById("gd-chat-messages");
  const form = document.getElementById("gd-chat-form");
  const input = document.getElementById("gd-chat-input");
  const sendButton = document.getElementById("gd-chat-send");
  const quick = document.getElementById("gd-chat-quick");

  if (!root || !launcher || !panel || !messages || !form || !input) return;

  const endpoint =
    `${window.GD_CONFIG?.SUPABASE_URL}/functions/v1/ai-assistant`;

  const submitEndpoint =
    `${window.GD_CONFIG?.SUPABASE_URL}/functions/v1/submit-chat-enquiry`;

  const conversationStorageKey =
    "gd360_ai_conversation_id_v1";

  const pendingEnquiryStorageKey =
    "gd360_ai_pending_enquiry_v1";

  let conversationId =
    localStorage.getItem(conversationStorageKey) || null;

  let busy = false;

  function openChat() {
    panel.hidden = false;
    launcher.hidden = true;
    launcher.setAttribute("aria-expanded", "true");

    window.setTimeout(() => {
      input.focus();
      messages.scrollTop = messages.scrollHeight;
    }, 50);
  }

  function closeChat() {
    panel.hidden = true;
    launcher.hidden = false;
    launcher.setAttribute("aria-expanded", "false");
  }

  function addMessage(role, text, extraClass = "") {
    const wrapper = document.createElement("div");
    wrapper.className =
      `gd-chat-message ${role} ${extraClass}`.trim();

    const bubble = document.createElement("div");

    String(text || "")
      .split(/\n{2,}/)
      .filter(Boolean)
      .forEach((paragraph) => {
        const p = document.createElement("p");
        p.textContent = paragraph.trim();
        bubble.appendChild(p);
      });

    wrapper.appendChild(bubble);
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;

    return wrapper;
  }

  function setBusy(state) {
    busy = state;
    input.disabled = state;
    sendButton.disabled = state;

    if (!state) {
      input.focus();
    }
  }

  function enquiryValue(value) {
    const text = String(value || "").trim();
    return text || "Not supplied";
  }

  function addEnquiryRow(container, label, value) {
    const row = document.createElement("div");
    row.className = "gd-enquiry-row";

    const key = document.createElement("span");
    key.textContent = label;

    const val = document.createElement("strong");
    val.textContent = enquiryValue(value);

    row.append(key, val);
    container.appendChild(row);
  }


  function renderHumanContactCard() {
    document
      .querySelectorAll(".gd-human-card")
      .forEach((card) => card.remove());

    document
      .querySelectorAll(".gd-enquiry-card")
      .forEach((card) => card.remove());

    const card = document.createElement("div");
    card.className = "gd-human-card";

    const title = document.createElement("h4");
    title.textContent = "Speak to a person";

    const intro = document.createElement("p");
    intro.textContent =
      "You don't need to choose a package. Leave your details and GD Studio 360 can review your request.";

    const fields = document.createElement("div");
    fields.className = "gd-human-fields";

    const name = document.createElement("input");
    name.placeholder = "Your name *";
    name.autocomplete = "name";

    const business = document.createElement("input");
    business.placeholder = "Business name (optional)";
    business.autocomplete = "organization";

    const email = document.createElement("input");
    email.type = "email";
    email.placeholder = "Email address *";
    email.autocomplete = "email";

    const phone = document.createElement("input");
    phone.type = "tel";
    phone.placeholder = "WhatsApp / phone (optional)";
    phone.autocomplete = "tel";

    const note = document.createElement("textarea");
    note.placeholder =
      "What would you like to discuss? (optional)";

    fields.append(
      name,
      business,
      email,
      phone,
      note
    );

    const consentLabel = document.createElement("label");
    consentLabel.className = "gd-enquiry-consent";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";

    const consentText = document.createElement("span");
    consentText.append("I agree to the ");

    const terms = document.createElement("a");
    terms.href = "terms.html";
    terms.target = "_blank";
    terms.rel = "noopener";
    terms.textContent = "Enquiry Terms";

    const andText = document.createTextNode(" and ");

    const privacy = document.createElement("a");
    privacy.href = "privacy.html";
    privacy.target = "_blank";
    privacy.rel = "noopener";
    privacy.textContent = "Privacy Notice";

    consentText.append(
      terms,
      andText,
      privacy,
      document.createTextNode(
        " and want GD Studio 360 to contact me."
      )
    );

    consentLabel.append(
      checkbox,
      consentText
    );

    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "gd-enquiry-submit";
    submit.textContent = "Request human contact";
    submit.disabled = true;

    const status = document.createElement("div");
    status.className = "gd-enquiry-status";
    status.textContent =
      "Your details have not been sent yet.";

    checkbox.addEventListener("change", () => {
      submit.disabled = !checkbox.checked;
    });

    submit.addEventListener("click", async () => {
      const nameValue = name.value.trim();
      const emailValue = email.value.trim();

      if (!nameValue) {
        status.textContent = "Please enter your name.";
        name.focus();
        return;
      }

      if (!email.checkValidity() || !emailValue) {
        status.textContent =
          "Please enter a valid email address.";
        email.focus();
        return;
      }

      if (!checkbox.checked) return;

      submit.disabled = true;
      checkbox.disabled = true;
      submit.textContent = "Sending…";
      status.textContent =
        "Sending your contact request securely…";

      try {
        const response = await fetch(submitEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            accepted_terms: true,
            human_contact: {
              name: nameValue,
              business: business.value.trim(),
              email: emailValue,
              phone: phone.value.trim(),
              message: note.value.trim()
            }
          })
        });

        let data = {};

        try {
          data = await response.json();
        } catch (_) {}

        if (!response.ok || !data?.ok) {
          throw new Error(
            data?.error || "Could not send the request."
          );
        }

        submit.textContent = "Contact request sent";
        status.textContent =
          "GD Studio 360 will review your request.";

        name.disabled = true;
        business.disabled = true;
        email.disabled = true;
        phone.disabled = true;
        note.disabled = true;

        addMessage(
          "assistant",
          data.reply ||
            "Thanks — your contact request has been sent."
        );

      } catch (error) {
        console.error(
          "GD Studio 360 human handoff:",
          error
        );

        checkbox.disabled = false;
        submit.disabled = !checkbox.checked;
        submit.textContent = "Request human contact";
        status.textContent =
          error instanceof Error
            ? error.message
            : "Could not send the request. Please try again.";
      }
    });

    card.append(
      title,
      intro,
      fields,
      consentLabel,
      submit,
      status
    );

    messages.appendChild(card);
    messages.scrollTop = messages.scrollHeight;
  }

  function renderEnquiryCard(enquiry) {
    if (!enquiry || !conversationId) return;

    document
      .querySelectorAll(".gd-enquiry-card")
      .forEach((card) => card.remove());

    const isHumanHandoff =
      enquiry.package === "Not sure — recommend one";

    const card = document.createElement("div");
    card.className = "gd-enquiry-card";

    const title = document.createElement("h4");
    title.textContent = isHumanHandoff
      ? "Human consultation request"
      : "Your enquiry details";

    const intro = document.createElement("p");
    intro.className = "gd-enquiry-card-intro";
    intro.textContent = isHumanHandoff
      ? "Please check your details before asking GD Studio 360 to contact you."
      : "Please check these details before submitting them to GD Studio 360.";

    const details = document.createElement("div");
    details.className = "gd-enquiry-details";

    addEnquiryRow(details, "Name", enquiry.name);
    addEnquiryRow(details, "Business", enquiry.business);
    addEnquiryRow(details, "Business type", enquiry.trade);
    addEnquiryRow(details, "Area", enquiry.area);
    addEnquiryRow(details, "Email", enquiry.email);

    if (enquiry.phone) {
      addEnquiryRow(details, "WhatsApp", enquiry.phone);
    }

    addEnquiryRow(details, "Package", enquiry.package);

    if (
      enquiry.care_plan &&
      enquiry.care_plan !== "No care plan"
    ) {
      addEnquiryRow(details, "Care", enquiry.care_plan);
    }

    addEnquiryRow(
      details,
      "Project",
      enquiry.project_summary
    );

    const consentLabel = document.createElement("label");
    consentLabel.className = "gd-enquiry-consent";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";

    const consentText = document.createElement("span");
    consentText.append(
      "I agree to the "
    );

    const terms = document.createElement("a");
    terms.href = "terms.html";
    terms.target = "_blank";
    terms.rel = "noopener";
    terms.textContent = "Enquiry Terms";

    const andText = document.createTextNode(" and ");

    const privacy = document.createElement("a");
    privacy.href = "privacy.html";
    privacy.target = "_blank";
    privacy.rel = "noopener";
    privacy.textContent = "Privacy Notice";

    consentText.append(
      terms,
      andText,
      privacy,
      document.createTextNode(
        " and want GD Studio 360 to receive these details."
      )
    );

    consentLabel.append(checkbox, consentText);

    const submit = document.createElement("button");
    submit.type = "button";
    submit.className = "gd-enquiry-submit";
    submit.textContent = isHumanHandoff
      ? "Request human contact"
      : "Submit enquiry";
    submit.disabled = true;

    const status = document.createElement("div");
    status.className = "gd-enquiry-status";
    status.textContent = isHumanHandoff
      ? "Your request has not been sent yet."
      : "Nothing has been submitted yet.";

    checkbox.addEventListener("change", () => {
      submit.disabled = !checkbox.checked;
    });

    submit.addEventListener("click", async () => {
      if (!checkbox.checked || busy) return;

      submit.disabled = true;
      checkbox.disabled = true;
      submit.textContent = isHumanHandoff
        ? "Sending request…"
        : "Submitting…";
      status.textContent = isHumanHandoff
        ? "Sending your contact request securely…"
        : "Sending your enquiry securely…";

      try {
        const response = await fetch(submitEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            accepted_terms: true
          })
        });

        let data = {};

        try {
          data = await response.json();
        } catch (_) {}

        if (!response.ok || !data?.ok) {
          throw new Error(
            data?.error || "Could not submit the enquiry."
          );
        }

        card.classList.add("submitted");
        submit.textContent = isHumanHandoff
          ? "Contact request sent"
          : "Enquiry submitted";
        status.textContent = isHumanHandoff
          ? "GD Studio 360 will review your request and contact you."
          : "Sent to GD Studio 360 for review.";

        localStorage.removeItem(
          pendingEnquiryStorageKey
        );

        addMessage(
          "assistant",
          data.reply ||
            "Thanks — your enquiry has been submitted."
        );

        messages.scrollTop = messages.scrollHeight;

      } catch (error) {
        console.error(
          "GD Studio 360 enquiry submit:",
          error
        );

        checkbox.disabled = false;
        submit.disabled = !checkbox.checked;
        submit.textContent = isHumanHandoff
          ? "Request human contact"
          : "Submit enquiry";
        status.textContent = isHumanHandoff
          ? "Could not send the contact request. Please try again."
          : "Submission failed. Please try again.";
      }
    });

    card.append(
      title,
      intro,
      details,
      consentLabel,
      submit,
      status
    );

    messages.appendChild(card);
    messages.scrollTop = messages.scrollHeight;
  }

  async function sendMessage(rawMessage) {
    const message = String(rawMessage || "").trim();

    if (!message || busy) return;

    openChat();

    quick?.remove();
    addMessage("customer", message);

    input.value = "";
    input.style.height = "auto";

    setBusy(true);

    const typing = addMessage(
      "assistant",
      "Thinking…",
      "typing"
    );

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message,
          conversation_id: conversationId
        })
      });

      let data = {};

      try {
        data = await response.json();
      } catch (_) {}

      typing.remove();

      if (!response.ok || !data?.ok) {
        throw new Error(
          data?.error || "The assistant is temporarily unavailable."
        );
      }

      if (data.conversation_id) {
        conversationId = data.conversation_id;

        localStorage.setItem(
          conversationStorageKey,
          conversationId
        );
      }

      addMessage("assistant", data.reply);

      if (data.human_handoff) {
        localStorage.removeItem(
          pendingEnquiryStorageKey
        );

        renderHumanContactCard();
      }

      if (
        data.requires_confirmation &&
        data.pending_enquiry
      ) {
        localStorage.setItem(
          pendingEnquiryStorageKey,
          JSON.stringify(data.pending_enquiry)
        );

        renderEnquiryCard(
          data.pending_enquiry
        );
      }

    } catch (error) {
      typing.remove();

      console.error("GD Studio 360 assistant:", error);

      addMessage(
        "assistant",
        "I’m having trouble replying right now. You can still send us an enquiry, WhatsApp message or email and we’ll get back to you."
      );
    } finally {
      setBusy(false);
    }
  }

  launcher.addEventListener("click", () => {
    if (panel.hidden) {
      openChat();
    } else {
      closeChat();
    }
  });

  closeButton?.addEventListener("click", closeChat);

  newChatButton?.addEventListener("click", () => {
    localStorage.removeItem(
      conversationStorageKey
    );

    localStorage.removeItem(
      pendingEnquiryStorageKey
    );

    window.location.reload();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height =
      `${Math.min(input.scrollHeight, 110)}px`;
  });

  document
    .querySelectorAll("[data-chat-prompt]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        sendMessage(button.dataset.chatPrompt);
      });
    });

  try {
    const savedPending =
      JSON.parse(
        localStorage.getItem(
          pendingEnquiryStorageKey
        ) || "null"
      );

    if (savedPending && conversationId) {
      renderEnquiryCard(savedPending);
    }
  } catch (_) {
    localStorage.removeItem(
      pendingEnquiryStorageKey
    );
  }
})();

/* GD STUDIO 360 AI ASSISTANT END */
