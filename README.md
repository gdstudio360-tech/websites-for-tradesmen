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


## V6 — Enquiry Terms

Added:
- `terms.html`
- required unticked checkbox on the enquiry form
- link to Enquiry Terms and Privacy Notice beside the form
- Enquiry Terms link in the footer
- clear statement that submitting the free-preview form is an enquiry, not an order or paid contract

Enquiry Terms cover:
- free preview scope
- customer responsibility for accurate business information
- rights/permission for supplied photos, logos, reviews and content
- package scope and extra costs
- estimated timings and customer dependencies
- no guarantee of rankings, leads or sales
- third-party services
- intellectual property at enquiry stage
- sensible liability wording
- privacy
- separate project terms if paid work proceeds
- preservation of applicable consumer rights

Important: a paid project should still use a separate quotation/project agreement rather than relying only on these enquiry terms.


## V7 — About / Trust

Added:
- `Why GD` navigation item
- new About / Trust section between the benefits and live demo
- positions GD TradeWeb as an independent service focused on UK trades
- mentions real UK electrical/BMS trade experience without overstating qualifications
- highlights direct communication, practical trade-minded websites and clear scope/pricing
- includes CTA to free homepage preview and live demo

This section is designed to answer the visitor's trust question: "Who is behind this service and why should I trust them?"


## V8 — Remove manual free preview

The manual free homepage preview offer has been removed.

New lead flow:
- CTA: Get a website quote / Tell us about your project
- enquiry form asks for business details
- optional current website/social link
- package-interest selector
- GD TradeWeb reviews the enquiry and recommends the appropriate package
- no unpaid design work is promised at enquiry stage

A future automated "Instant Preview" tool can be added separately if it can generate the preview without manual design time.


## V9 — Package selection carried into enquiry

Pricing buttons now carry the selected package into the enquiry form.

Behaviour:
- Choose Starter -> form selects `Starter — £249`
- Choose Business -> form selects `Business — £399`
- Choose Pro -> form selects `Pro — £599`
- the chosen package is shown clearly at the top of the enquiry form
- visitor can still change the package before submitting
- Formspree receives the `package` field, so the chosen package appears in the enquiry submission/email
- generic CTAs keep `Not sure — recommend one` unless the visitor selects a package manually


## V10 — Admin approval + deposit workflow

This version adds the foundation for the complete customer pipeline:

`NEW -> DEPOSIT SENT -> DEPOSIT PAID -> BUILDING -> REVIEW -> BALANCE DUE -> COMPLETED`

### New public files
- `site-config.js` — public Supabase URL + publishable key
- `payment-success.html`
- `payment-cancelled.html`

### New private/admin UI
- `admin.html`
- `admin.css`
- `admin.js`

The admin page is not linked publicly and is protected by Supabase Auth + database Row Level Security.
Knowing the URL alone does not grant access.

### New Supabase files
- `supabase/schema.sql`
- `supabase/functions/approve-lead/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/config.toml`

### How the live workflow works
1. Customer submits the normal website enquiry.
2. Formspree still sends the existing notification email.
3. When Supabase is connected, the same enquiry is also stored in the admin pipeline.
4. Admin signs into `admin.html`.
5. Admin reviews the lead and clicks `Approve & create deposit`.
6. Secure server-side function creates the correct 50% Stripe Checkout deposit:
   - Starter £249 -> £124.50
   - Business £399 -> £199.50
   - Pro £599 -> £299.50
7. If Resend email is configured, approval + payment link is emailed automatically.
8. Stripe webhook changes the lead to `DEPOSIT PAID` after successful payment.
9. Admin can move it to `BUILDING` and later `COMPLETED`.

### Important security rule
Only browser-safe Supabase values go in `site-config.js`.

Never put these into GitHub/public JavaScript:
- Stripe secret key
- Stripe webhook secret
- Supabase service-role / secret key
- Resend API key

Those belong only in Supabase Edge Function secrets.

### Setup still required
The code is ready, but live automation requires external account configuration:
1. Create Supabase project.
2. Run `supabase/schema.sql`.
3. Create one Supabase Auth user and add its UUID to `admin_users`.
4. Put Supabase URL + publishable key in `site-config.js`.
5. Create Stripe account and add `STRIPE_SECRET_KEY` as a Supabase function secret.
6. Set `SITE_URL`.
7. Deploy `approve-lead` and `stripe-webhook`.
8. Add Stripe webhook endpoint and save `STRIPE_WEBHOOK_SECRET`.
9. Optional: configure Resend (`RESEND_API_KEY`, `EMAIL_FROM`) for automatic approval emails.

Until Supabase is connected, the existing Formspree enquiry flow continues to work.


## V11 — SumUp Hosted Checkout

V11 replaces the planned Stripe payment integration with the existing GD TradeWeb SumUp merchant account.

### Important design change
SumUp Hosted Checkout sessions are short-lived (currently around 30 minutes), so V11 does **not** create the actual SumUp checkout when an admin approves a project.

Instead:
1. Admin approves a lead.
2. A long-lived GD TradeWeb payment-request URL is generated.
3. Client opens that URL and reviews business / package / deposit.
4. Client accepts the project terms.
5. Only then does the server create a **fresh SumUp Hosted Checkout**.
6. Client is redirected to SumUp to pay.
7. SumUp calls the webhook when checkout status changes.
8. The webhook retrieves the checkout from SumUp again and verifies `PAID`, amount and GBP currency before changing the project to `deposit_paid`.

This avoids emailing a SumUp payment URL that may expire before the client opens it.

### SumUp secrets
Store these only as Supabase Edge Function secrets:
- `SUMUP_API_KEY`
- `SUMUP_MERCHANT_CODE`

Do not put either value in GitHub Pages JavaScript.

### V11 Edge Functions
- `approve-lead`
- `payment-request-info`
- `create-sumup-checkout`
- `sumup-webhook`

### Public payment files
- `pay-deposit.html`
- `pay-deposit.js`

The existing Formspree enquiry notification remains in place.
