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
        form.reset();
        setFormStatus(
          "Thanks — your request has been sent. We’ll get back to you as soon as possible.",
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
        if (label) label.textContent = originalLabel || "Request my free preview →";
      }
    }
  });
}
