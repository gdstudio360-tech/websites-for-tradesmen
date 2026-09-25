# GD TradeWeb — Websites for UK Tradesmen

Sales landing page for a website-building service aimed at UK tradespeople.

## Current positioning
- Electricians
- Plumbers
- Builders
- Roofers
- Mechanics / garages
- Decorators
- Other local trades

## Introductory launch packages
- Starter — £249
- Business — £399
- Pro — £599
- Optional care — from £29/month

Launch pricing is positioned as an introductory rate while building the UK trades portfolio, not as a fake percentage discount.

### Package limits
- Starter: 1 page, up to 6 core sections, 1 revision round
- Business: up to 5 pages, 2 revision rounds
- Pro: up to 8 pages, 3 revision rounds
- Domain registration, paid third-party services and work outside package scope are quoted separately

## Live demo linked from the site
https://gdstudio360-tech.github.io/tradesman-template/

## Contact setup

Configured for:
- GD Studio 360 email
- UK phone number
- WhatsApp message link with a pre-filled text message

The phone number and email are not shown as plain text in the HTML. They are assembled in `script.js`.
This helps against simple scraping but is not absolute protection from determined bots.

The WhatsApp button opens a text conversation. A website link cannot disable WhatsApp's own call button after the visitor opens the chat.

## Suggested GitHub repository
`websites-for-tradesmen`

Upload:
- `index.html`
- `styles.css`
- `script.js`
- `README.md`

Then enable GitHub Pages:
Settings → Pages → Deploy from a branch → main → /(root)

## Next upgrades
- Connect a real form service instead of mailto
- Add a custom domain
- Add real portfolio examples as they are completed
- Add genuine client testimonials only after receiving them
- Add privacy / cookie content if tracking or analytics are introduced


## Real enquiry form — V4

The old `mailto:` enquiry form has been replaced with an AJAX-ready Formspree integration.

Before the form can receive live enquiries:

1. Create a Formspree account and verify the destination email.
2. Create a new form.
3. Copy the Form ID from the endpoint, for example `xabcdefg`.
4. Open `script.js`.
5. Replace `PASTE_FORMSPREE_FORM_ID_HERE` with the real Formspree Form ID.

The form:
- submits without opening the visitor's email app
- shows sending / success / error states on the same page
- disables the button while sending
- keeps the destination email address out of the public HTML
- includes Formspree's `_gotcha` honeypot field
- handles rate-limit and network errors

Do not advertise the form as live until the Formspree Form ID has been added and a test submission has been received.


## Live Formspree ID
Configured Formspree form ID: `mjykeaej`


## V5 — Privacy Notice

Added:
- `privacy.html` in the same GD TradeWeb visual style
- Privacy Notice link directly beside the enquiry form
- Privacy Notice link in the footer
- clearer form privacy wording
- UK privacy sections covering purpose, lawful basis, retention, Formspree, international processing, rights, objections, complaints and automated decisions

Current privacy policy assumptions:
- enquiry data is used only to respond to enquiries / prepare requested services
- no marketing list is created from this form
- non-client enquiries are normally deleted or anonymised within 12 months
- Formspree is used as the form processor
- no analytics or advertising tracking has been added to this website

Before adding analytics, advertising pixels, mailing-list marketing, new form integrations or other tracking, review the Privacy Notice and cookie requirements again.

Note: if the business later confirms a formal legal/trading identity that should appear publicly, update the "Who we are" section accordingly.
