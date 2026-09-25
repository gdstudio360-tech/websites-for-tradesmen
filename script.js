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

const form = document.getElementById("lead-form");
if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const business = String(data.get("business") || "").trim();
    const trade = String(data.get("trade") || "").trim();
    const area = String(data.get("area") || "").trim();
    const contact = String(data.get("contact") || "").trim();
    const message = String(data.get("message") || "").trim();

    const subject = encodeURIComponent(`Free website preview request — ${business || trade}`);
    const body = encodeURIComponent(
      `Name: ${name}\nBusiness: ${business}\nTrade: ${trade}\nArea: ${area}\nPhone/email: ${contact}\n\nExtra details:\n${message}`
    );

    /* IMPORTANT:
       Replace YOUR-EMAIL@example.com with your real business email address before advertising.
    */
    window.location.href =
      `mailto:YOUR-EMAIL@example.com?subject=${subject}&body=${body}`;
  });
}
