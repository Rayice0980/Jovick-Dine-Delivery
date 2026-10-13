# Jovick Dine Delivery payments rollout

This feature is being prepared on `feature/item-ratings-payment-ledger`. It is not deployed and the live Supabase schema or Paystack settings have not been changed.

## Required configuration before enabling checkout

1. Apply and verify `supabase/migrations/20261013120000_item_reviews_and_payment_ledger.sql` in a non-production Supabase environment first.
2. Add an active row to `public.delivery_fee_quotes` for every supported delivery area and restaurant-stop count. Each row must reflect the dispatch plan that will actually be used:
   - `shared_courier` when one courier can collect from the listed restaurants and deliver to the customer.
   - `separate_couriers` when the operational plan requires separate routes.
   The migration enforces at most one active quote for an area and stop count. Set `cash_on_delivery_enabled = true` only for routes where COD is operationally supported. No arbitrary zero-fee fallback is used.
3. Verify each restaurant's settlement bank details and create its Paystack subaccount through the Paystack dashboard or approved onboarding process. Store only the verified `subaccount_code` in `public.restaurant_payment_accounts`, then enable that account after verification.
4. Configure Supabase Edge Function secrets in a test environment:
   - `PAYSTACK_SECRET_KEY` — test secret key first; never place it in browser code.
   - `SITE_URL` — exact deployed origin, without a trailing slash.
   Supabase provides the project URL and API keys to Edge Functions.
5. Deploy `checkout-payments` with JWT verification disabled only because it validates customer JWTs itself and validates Paystack webhook signatures itself. Configure the Paystack webhook URL to the function endpoint and test the webhook signature.
6. Test Paystack split eligibility using test-mode subaccounts before enabling live keys. If a restaurant has no verified subaccount, the transaction can still be paid to the platform account and that restaurant's net payable remains pending in the ledger for reconciliation.

## Accounting rules implemented

- Commission is 10% of each restaurant's food subtotal, rounded to the nearest whole naira.
- Settlement allocations are stored in kobo to preserve gateway-fee precision.
- One combined delivery fee is selected server-side from the active delivery quote for the area and number of restaurant stops.
- The delivery-fee allocation remains pending until the courier settlement process is defined.
- Paystack payments are initialized server-side, verified server-side, and checked against the exact checkout amount and currency.
- The webhook is HMAC-SHA512 signature-checked and event processing is idempotent.
- Restaurant orders are finalized only after a verified Paystack payment, or immediately for an explicitly supported cash-on-delivery checkout.
- Cash-on-delivery checkouts remain `cash_due`; they are not treated as paid.
- The checkout function does not accept a client-supplied total or delivery fee.

## Required test cases before merge

- One restaurant, multiple restaurants, and an accepted private pre-order.
- No delivery quote configured, inactive quote, and multiple-stop quote.
- Price changed after the menu was loaded.
- Restaurant pending/unapproved or food unavailable.
- COD supported vs unsupported area.
- Paystack successful, failed, pending, mismatched amount, mismatched currency, duplicate webhook, and callback-before-webhook.
- A restaurant with a verified subaccount, one without a subaccount, and split creation failure.
- Duplicate checkout submission using the same idempotency key.
- Item review eligibility, duplicate review prevention, independent food ratings, and private pre-order review privacy.
- RLS checks using separate customer and restaurant accounts.

Do not merge to production or enable live Paystack settings until these tests pass and the delivery quote table has real operational values.
