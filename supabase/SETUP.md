# Supabase setup for Jovick Dine Delivery

This project uses plain HTML, CSS and JavaScript with the pinned Supabase JavaScript client.

## Dedicated project

The dedicated project is **Jovick Dine Delivery** in the **Jovick Travel & Tours** organization, region London (eu-west-2).

- Project URL: https://iveyrlvlejpdrbymsjsw.supabase.co
- Project reference: iveyrlvlejpdrbymsjsw
- Public publishable key: configured in scripts/supabase-config.js

The separate pre-existing project and its contact_messages rows were not used or modified for this setup.

## 1. Browser connection settings

The project URL and publishable key are already configured in scripts/supabase-config.js. These values are intended to be public in browser code. Never place a Supabase secret or service_role key in website code, HTML, CSS, GitHub, or browser environment variables.

## 2. Database schema and account security

The reviewed SQL file supabase/setup/customer_restaurant_auth.sql has been applied to the dedicated project. It creates:
- public.profiles — one account profile per Supabase Auth user.
- public.restaurants — restaurant details and approval status.
- Row Level Security (RLS) policies and restricted database grants.
- A private signup trigger that creates profiles and places restaurant accounts into pending review.

The browser cannot choose its own database permissions. The profile's account type is not user-editable, and a restaurant cannot change its approval status from the browser.

## 3. Finish Auth URL configuration in the dashboard

In the Supabase Dashboard for Jovick Dine Delivery, open Authentication → URL Configuration:
- Set the Site URL to your actual deployed website URL.
- Add your local Live Server URL (for example, http://127.0.0.1:5500/**) and the deployed site's login page URL to Redirect URLs.
- Keep email confirmation enabled for real customer accounts.

These dashboard URL settings require a manual check; they have not been changed automatically. The signup page sends confirmation links to login.html. Test using the deployed website or VS Code Live Server; opening the HTML files directly with a file:// URL is not supported for Supabase Auth.

## 4. Approve a restaurant

New restaurant accounts are created with status pending. Review business details before approving them. An administrator can update public.restaurants.status to approved in the SQL Editor after checking the business. Do not grant restaurant access just because a signup form requested the restaurant account type.

## 5. Security model

- Signed-out visitors cannot read profiles or restaurant records.
- A signed-in user can read only their own profile.
- A user can update only their own full_name and phone; they cannot update account_type.
- A restaurant owner can read only their own restaurant record.
- Browser users cannot insert or update restaurant records or change approval status.
- The signup trigger is in the non-public private schema, has an empty search path, and has execute privileges revoked from browser roles.
- Never add a Supabase secret/service-role key to this static site.

This setup does not yet include customer orders, menu management, restaurant dashboard pages, admin approval screens, payments, or delivery tracking.