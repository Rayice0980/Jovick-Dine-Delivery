# Jovick Dine Delivery

A responsive Nigerian food delivery website for a brand headquartered in Abuja, built with plain HTML, CSS and vanilla JavaScript.

## Run it on your computer

1. On the GitHub repository page, click the green **Code** button.
2. Choose **Download ZIP** and extract the ZIP file.
3. Open the extracted folder in Visual Studio Code (or another code editor).
4. Open `index.html` in your browser. For the best local development experience, use VS Code with the Live Server extension.

No package manager, build step, framework or server is required for the front-end demo.

## Pages and their files

Every page has its own HTML file, stylesheet and JavaScript file:

| Page | HTML | Page CSS | Page JavaScript |
| --- | --- | --- | --- |
| Home | `index.html` | `styles/index.css` | `scripts/index.js` |
| Menu | `foods.html` | `styles/foods.css` | `scripts/foods.js` |
| About | `about.html` | `styles/about.css` | `scripts/about.js` |
| How it works | `features.html` | `styles/features.css` | `scripts/features.js` |
| Contact | `contact.html` | `styles/contact.css` | `scripts/contact.js` |
| FAQs | `faq.html` | `styles/faq.css` | `scripts/faq.js` |
| Sign in | `login.html` | `styles/login.css` | `scripts/login.js` |
| Sign up | `signup.html` | `styles/signup.css` | `scripts/signup.js` |
| Checkout | `checkout.html` | `styles/checkout.css` | `scripts/checkout.js` |

## Shared files

- `styles/site.css` — retained as the original shared style reference; individual pages no longer depend on it.
- `scripts/app.js` — shared navigation/footer rendering, menu data, category filtering, shopping bag, and demo form feedback.

Each HTML page loads the shared files and its own page-specific CSS and JavaScript. Change the page-specific files for one page; change the shared files when you want a site-wide update.

## Before accepting real orders

This repository is a static front-end demonstration. The shopping bag uses browser local storage. Supabase now handles account registration and sign-in, but checkout, order management, payment processing and delivery tracking are not implemented as live services. Connect and test a secure backend and payment provider before launch. Confirm the menu, prices, photos, delivery areas, business contact details and service hours. Menu photos currently load from Unsplash and need an internet connection.

## Customer dashboard

- `dashboard.html` — signed-in customer overview, profile editor, order-history placeholder, and links to the food menu.
- `styles/dashboard.css` — responsive dashboard styling.
- `scripts/dashboard.js` — checks the Supabase session, loads the signed-in user's own profile, saves permitted profile fields, and signs out.
- Successful customer sign-in opens the dashboard. Dashboard profile updates use the existing Row Level Security policies and only update `full_name` and `phone`.

**Ordering status:** the menu and shopping bag remain demonstration features. The dashboard does not claim to submit live orders or take payment; order placement, trusted price validation, payment processing, and delivery tracking still need a secure backend.

## Account pages

- `signup.html` — choose a customer account or restaurant business account.
- `styles/signup.css` and `scripts/signup.js` — signup layout, conditional restaurant fields, password visibility and password matching.
- `login.html` — choose the account type before entering sign-in details.
- `styles/login.css` and `scripts/login.js` — sign-in layout and password visibility.

## Supabase customer and restaurant authentication

The account pages use Supabase Auth for email/password registration, sign-in, email confirmation, sign-out and password recovery. The project URL and public publishable key are configured in `scripts/supabase-config.js`.

The dedicated Supabase project is **Jovick Dine Delivery** in the **Jovick Travel & Tours** organization, London region (`eu-west-2`). Project reference: `iveyrlvlejpdrbymsjsw`. The reviewed SQL in `supabase/setup/customer_restaurant_auth.sql` has been applied to this dedicated project. It creates profiles and restaurant records, enables Row Level Security, limits profile updates to a user's name and phone, and keeps new restaurant registrations pending until reviewed.

The previous Supabase project and its saved `contact_messages` records were kept separate and were not used for this setup.

Before testing real registration, follow [the Supabase setup guide](supabase/SETUP.md) and complete **Authentication → URL Configuration** in the Supabase Dashboard with the deployed website URL and local Live Server redirect URL. Those dashboard URL settings still need a manual check.

**Security:** Browser code must contain only the public project URL and publishable key. Never add a secret or service-role key to the website. This setup does not yet include customer orders, menu management, restaurant dashboard pages, admin approval screens, payments, or delivery tracking.
