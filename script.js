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

const form = document.getElementById("lead-form");
if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const business = String(data.get("business") || "").trim();
    const trade = String(data.get("trade") || "").trim();
    const area = String(data.get("area") || "").trim();
    const replyTo = String(data.get("contact") || "").trim();
    const message = String(data.get("message") || "").trim();

    const subject = encodeURIComponent(`Free website preview request — ${business || trade}`);
    const body = encodeURIComponent(
      `Name: ${name}\nBusiness: ${business}\nTrade: ${trade}\nArea: ${area}\nPhone/email: ${replyTo}\n\nExtra details:\n${message}`
    );

    window.location.href =
      `mailto:${contact.email}?subject=${subject}&body=${body}`;
  });
}
