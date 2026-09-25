# GD TradeWeb V11 — SumUp setup

Your SumUp API key is a secret. Do not paste it into `site-config.js`, GitHub, HTML or browser JavaScript.

## 1. Supabase project
Create a Supabase project first.

Then:
1. Open SQL Editor.
2. Run `supabase/schema.sql`.
3. Create your admin user in Authentication.
4. Copy that Auth user's UUID.
5. Run:
   `insert into public.admin_users(user_id) values ('YOUR_AUTH_USER_UUID');`

## 2. Public Supabase browser config
In Supabase Project Settings / API, copy:
- Project URL
- Publishable key

Put only those two browser-safe values into `site-config.js`.

## 3. Private Edge Function secrets
In Supabase Edge Function secrets, add:
- `SUMUP_API_KEY` = the secret SumUp API key you already created
- `SUMUP_MERCHANT_CODE` = your SumUp merchant code
- `SITE_URL` = final GD TradeWeb site URL

Optional automatic email:
- `RESEND_API_KEY`
- `EMAIL_FROM`

## 4. Deploy functions
Deploy:
- `approve-lead`
- `payment-request-info`
- `create-sumup-checkout`
- `sumup-webhook`

The `supabase/config.toml` file sets the customer-facing functions / webhook to `verify_jwt = false`.
Security still comes from the unguessable payment token and server-side validation.

## 5. How payment works
The admin approval does not create the short-lived SumUp checkout.

It creates a URL such as:
`https://YOUR-SITE/pay-deposit.html?token=...`

When the customer clicks **Continue to SumUp**, `create-sumup-checkout` creates a fresh Hosted Checkout using:
- GBP
- the correct 50% deposit
- your SumUp merchant code
- `hosted_checkout.enabled = true`
- a backend `return_url` pointing at the SumUp webhook
- a website `redirect_url` for returning after payment

## 6. SumUp webhook
No separate webhook registration step is required for this checkout flow.
The webhook URL is supplied as the SumUp checkout `return_url`.

When SumUp sends `CHECKOUT_STATUS_CHANGED`, the webhook retrieves that checkout directly from SumUp and only marks the lead paid after it verifies:
- status is `PAID`
- amount matches the expected deposit
- currency is `GBP`

## 7. Deposit amounts
- Starter £249 -> £124.50
- Business £399 -> £199.50
- Pro £599 -> £299.50

## Security
Never expose:
- SumUp API key
- Supabase secret/service-role key
- Resend API key

`site-config.js` may contain only the Supabase Project URL and publishable key.
