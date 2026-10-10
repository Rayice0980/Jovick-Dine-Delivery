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

| Page         | HTML            | Page CSS              | Page JavaScript       |
| ------------ | --------------- | --------------------- | --------------------- |
| Home         | `index.html`    | `styles/index.css`    | `scripts/index.js`    |
| Menu         | `foods.html`    | `styles/foods.css`    | `scripts/foods.js`    |
| About        | `about.html`    | `styles/about.css`    | `scripts/about.js`    |
| How it works | `features.html` | `styles/features.css` | `scripts/features.js` |
| Contact      | `contact.html`  | `styles/contact.css`  | `scripts/contact.js`  |
| FAQs         | `faq.html`      | `styles/faq.css`      | `scripts/faq.js`      |
| Sign in      | `login.html`    | `styles/login.css`    | `scripts/login.js`    |
| Sign up      | `signup.html`   | `styles/signup.css`   | `scripts/signup.js`   |
| Checkout     | `checkout.html` | `styles/checkout.css` | `scripts/checkout.js` |

## Shared files

- `styles/site.css` — retained as the original shared style reference; individual pages no longer depend on it.
- `scripts/app.js` — shared navigation/footer rendering, menu data, category filtering, shopping bag, and demo form feedback.

Each HTML page loads the shared files and its own page-specific CSS and JavaScript. Change the page-specific files for one page; change the shared files when you want a site-wide update. Comments at the top of the page files explain their purpose.

## Before accepting real orders

This repository is a static front-end demonstration. The shopping bag uses browser local storage. Checkout, contact, sign-in and sign-up do not submit to a live service; there is no real account authentication, payment processing, order management or delivery tracking. Connect a secure backend and payment provider before launch. Confirm the menu, prices, photos, delivery areas, business contact details and service hours. Menu photos currently load from Unsplash and need an internet connection.

## Account pages

- `signup.html` — choose a customer account or restaurant business account.
- `styles/signup.css` and `scripts/signup.js` — signup layout, conditional restaurant fields, password visibility and password matching.
- `login.html` — choose the account type before entering sign-in details.
- `styles/login.css` and `scripts/login.js` — sign-in layout and password visibility.

The account pages currently provide front-end forms only. They do **not** create accounts, store user details, verify restaurant businesses, authenticate passwords or protect private pages. Do not collect real customer details until a secure backend and authentication service have been connected. Restaurant verification, customer profiles, restaurant dashboards and order management should be added as backend-backed features.
