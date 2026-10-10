# Supabase setup for Jovick Dine Delivery

This project uses plain HTML, CSS and JavaScript with the pinned Supabase JavaScript client.

## 1. Choose the correct Supabase project

Use a dedicated Supabase project for Jovick Dine Delivery. An existing project in the connected account has a populated `contact_messages` table, so do not apply this setup there unless you have confirmed that project belongs to this website.

## 2. Add the public connection values

Open `scripts/supabase-config.js` and replace:
- `PASTE_YOUR_SUPABASE_PROJECT_URL_HERE` with the Project URL from Supabase **Project Settings → API**.
- `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE` with the project's **publishable key** (starts with `sb_publishable_`). A legacy `anon` key also works if that is what the project provides.

These are public browser values. Never use a secret key or `service_role` key in website code, HTML, CSS, GitHub, or browser environment variables.

## 3. Create the database tables and security policies

Open the selected project's **SQL Editor**, review and run `supabase/setup/customer_restaurant_auth.sql`. It creates:
- `public.profiles` — one account profile per Supabase Auth user.
- `public.restaurants` — restaurant details and approval status.
- Row Level Security (RLS) policies and restricted database grants.
- A private signup trigger that creates profiles and places restaurant accounts into pending review.

The browser cannot choose its own database permissions. The profile's account type is not user-editable, and a restaurant cannot change its approval status from the browser.

## 4. Configure email confirmation

In the Supabase Dashboard, open **Authentication → URL Configuration**:
- Set the Site URL to your actual deployed website URL.
- Add your local Live Server URL (for example, `http://127.0.0.1:5500/**`) and the deployed site's login page URL to Redirect URLs.
- Keep email confirmation enabled for real customer accounts.

The signup page sends confirmation links to `login.html`. Test the flow using your deployed website or VS Code Live Server; opening the HTML files directly with a `file://` URL is not supported for Supabase Auth.

## 5. Approve a restaurant

New restaurant accounts are created with status `pending`. Review business details before approving them. An administrator can update `public.restaurants.status` to `approved` in the SQL Editor after checking the business. Do not grant restaurant access just because a signup form requested the restaurant account type.

## 6. Verify the security model

- Signed-out visitors cannot read profiles or restaurant records.
- A signed-in user can read only their own profile.
- A user can update only their own `full_name` and `phone`; they cannot update `account_type`.
- A restaurant owner can read only their own restaurant record.
- Browser users cannot insert or update restaurant records or change approval status.
- Never add a Supabase secret/service-role key to this static site.

This setup does not yet include customer orders, menu management, restaurant dashboard pages, admin approval screens, payments, or delivery tracking.
