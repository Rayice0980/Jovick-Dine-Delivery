const FOOD = [];
const money = (n) => "₦" + Number(n).toLocaleString("en-NG");
let cart = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem("jovick-cart") || "[]");
      return Array.isArray(saved)
        ? saved.filter(
            (item) =>
              item?.preorderRequestId ||
              FOOD.some((food) => Number(food.id) === Number(item.id)),
          )
        : [];
    } catch {
      return [];
    }
  })(),
  activeCategory = "All",
  searchTerm = "";
const page = document.body.dataset.page || "home";
const navItems = [
  ["Home", "index.html", "home"],
  ["Our menu", "foods.html", "foods"],
  ["Our story", "about.html", "about"],
  ["How it works", "features.html", "features"],
  ["Contact", "contact.html", "contact"],
];
function header() {
  return (
    '<div class="announcement">Freshly prepared in Abuja · Delivery across selected FCT locations</div><header class="site-header"><div class="container nav"><a class="brand" href="index.html"><span class="brand-mark">J</span><span>jovick dine<small>GOOD FOOD. GOOD MOOD.</small></span></a><nav class="nav-links" id="navLinks">' +
    navItems
      .map(
        ([n, u, k]) =>
          '<a class="' +
          (page === k ? "active" : "") +
          '" href="' +
          u +
          '">' +
          n +
          "</a>",
      )
      .join("") +
    '<a href="faq.html">FAQs</a><a href="index.html" data-signout-link hidden>Sign out</a></nav><div class="nav-actions"><button class="cart-btn" data-cart-open aria-label="Open shopping cart">Bag <span class="cart-count" id="cartCount">' +
    cart.reduce((s, i) => s + i.qty, 0) +
    '</span></button><a class="profile-btn" href="login.html" data-profile-link aria-label="Open your account" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--line);background:#fff;border-radius:99px;padding:9px 12px;font-weight:700;font-size:13px;white-space:nowrap;color:var(--ink)"><span aria-hidden="true">♙</span><span>Profile</span></a><a class="btn" href="foods.html">Order food ↗</a><button class="menu-toggle" id="menuToggle" aria-label="Toggle navigation" aria-expanded="false">☰</button></div></div></header>'
  );
}
function footer() {
  return (
    '<footer class="site-footer"><div class="container"><div class="footer-grid"><div><a class="brand" href="index.html"><span class="brand-mark">J</span><span>jovick dine<small>GOOD FOOD. GOOD MOOD.</small></span></a><p>Good food, thoughtfully made and delivered to your door. Proudly serving Abuja, one delicious meal at a time.</p><p>📍 Head office: Abuja, FCT, Nigeria</p></div><div><h3>Explore</h3><div class="footer-links"><a href="foods.html">Our menu</a><a href="about.html">Our story</a><a href="features.html">How it works</a><a href="faq.html">FAQs</a></div></div><div><h3>Need a hand?</h3><div class="footer-links"><a href="contact.html">Contact us</a><a href="login.html">Sign in</a><a href="signup.html">Create account</a><a href="contact.html">Delivery questions</a></div></div><div><h3>Made for Abuja</h3><p>From Wuse to Garki and beyond, we’re building a better way to enjoy your favourites.</p><p>Mon–Sat · 9:00am–9:00pm</p></div></div><div class="footer-bottom"><p>© ' +
    new Date().getFullYear() +
    " Jovick Dine Delivery. All rights reserved.</p><p>Made with care in Abuja, Nigeria 🇳🇬</p></div></div></footer>"
  );
}
function drawer() {
  return '<div class="cart-drawer" id="cartDrawer" role="dialog" aria-modal="true" aria-label="Your shopping bag"><div class="cart-panel"><div class="cart-header"><h2 style="font-size:28px;margin:0">Your bag <span id="cartCountHeading"></span></h2><button class="cart-close" data-cart-close aria-label="Close bag">✕</button></div><div id="cartContents"></div></div></div><div class="toast" id="toast" role="status"></div>';
}
function foodCard(f) {
  return (
    '<article class="food-card"><div class="food-image-wrap"><img class="food-image" loading="lazy" src="' +
    f.image +
    '" alt="' +
    f.name +
    '" onerror="this.style.opacity=.15"><span class="food-tag">' +
    f.tag +
    '</span></div><div class="food-body"><div class="food-title-row"><h3>' +
    f.name +
    '</h3><span class="food-rating">' +
    (f.rating === "New"
      ? "New"
      : "★ " + f.rating + " (" + f.ratingCount + ")") +
    '</span></div><p class="food-description">' +
    f.desc +
    "</p>" +
    (f.restaurantName
      ? '<p class="food-restaurant-name">By ' + f.restaurantName + "</p>"
      : "") +
    '<div class="food-bottom"><span class="price">' +
    money(f.price) +
    '</span><button class="add-btn" data-add="' +
    f.id +
    '" aria-label="Add ' +
    f.name +
    ' to bag">+</button></div></div></article>'
  );
}
function renderFoodGrid(target, limit) {
  const el = document.getElementById(target);
  if (!el) return;
  let items = FOOD.filter(
    (f) =>
      (activeCategory === "All" || f.category === activeCategory) &&
      (f.name + " " + f.desc + " " + f.category)
        .toLowerCase()
        .includes(searchTerm),
  );
  if (limit) items = items.slice(0, limit);
  el.innerHTML = items.length
    ? items.map(foodCard).join("")
    : '<div class="menu-empty-state"><h3>No dishes available yet</h3><p>Approved food businesses will publish their menus here. Please check back soon.</p></div>';
}
function cartItemKey(item) {
  return item.preorderRequestId
    ? "preorder:" + item.preorderRequestId
    : String(item.id);
}
function persist() {
  localStorage.setItem("jovick-cart", JSON.stringify(cart));
  document
    .querySelectorAll("#cartCount")
    .forEach(
      (e) => (e.textContent = cart.reduce((s, i) => s + Number(i.qty || 0), 0)),
    );
  renderCart();
}
function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(window.jovickToast);
  window.jovickToast = setTimeout(() => t.classList.remove("show"), 2300);
}
function addToCart(id) {
  const f = FOOD.find((x) => x.id === id);
  if (!f) return;
  const item = cart.find(
    (x) => !x.preorderRequestId && Number(x.id) === Number(id),
  );
  if (item) item.qty++;
  else cart.push({ id, qty: 1 });
  persist();
  toast(f.name + " added to your bag");
}
window.jovickAddToCartAuthorized = addToCart;
function changeQty(key, d) {
  const item = cart.find((entry) => cartItemKey(entry) === String(key));
  if (!item) return;
  item.qty = Number(item.qty) + d;
  if (item.qty <= 0)
    cart = cart.filter((entry) => cartItemKey(entry) !== String(key));
  persist();
}
function removeFromCart(key) {
  cart = cart.filter((item) => cartItemKey(item) !== String(key));
  persist();
  toast("Dish removed from your bag");
}
function renderCart() {
  const root = document.getElementById("cartContents");
  if (!root) return;
  cart = cart.filter(
    (item) =>
      item?.preorderRequestId ||
      FOOD.some((food) => Number(food.id) === Number(item.id)),
  );
  const entries = cart
    .map((item) => {
      const preorder = Boolean(item.preorderRequestId);
      const food = preorder
        ? {
            name: item.name || "Accepted pre-order",
            price: Number(item.price || 0),
            restaurantName: item.restaurantName || "The accepting business",
          }
        : FOOD.find((entry) => Number(entry.id) === Number(item.id));
      return food ? { item, food, preorder, key: cartItemKey(item) } : null;
    })
    .filter(Boolean);
  const count = entries.reduce(
    (sum, entry) => sum + Number(entry.item.qty || 0),
    0,
  );
  const subtotal = entries.reduce(
    (sum, entry) => sum + Number(entry.food.price) * Number(entry.item.qty),
    0,
  );
  const countHeading = document.getElementById("cartCountHeading");
  if (countHeading) countHeading.textContent = count ? "(" + count + ")" : "";
  document
    .querySelectorAll("#cartCount")
    .forEach((node) => (node.textContent = String(count)));
  root.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-cart";
    const icon = document.createElement("span");
    icon.textContent = "🥡";
    const title = document.createElement("h3");
    title.textContent = "Your bag is taking a break";
    const copy = document.createElement("p");
    copy.textContent = "Add a few favourites and we’ll get things ready.";
    const link = document.createElement("a");
    link.className = "btn";
    link.href = "foods.html";
    link.textContent = "Explore the menu";
    empty.append(icon, title, copy, link);
    root.append(empty);
    return;
  }
  entries.forEach(({ item, food, preorder, key }) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = food.name;
    const unit = document.createElement("small");
    unit.textContent =
      money(food.price) +
      " each" +
      (preorder ? " · Private pre-order for " + food.restaurantName : "");
    const quantity = document.createElement("div");
    quantity.className = "quantity";
    if (preorder) {
      quantity.textContent = "Quantity agreed with business: " + item.qty;
    } else {
      const minus = document.createElement("button");
      minus.type = "button";
      minus.dataset.qty = key;
      minus.dataset.delta = "-1";
      minus.setAttribute("aria-label", "Remove one");
      minus.textContent = "−";
      const amount = document.createElement("span");
      amount.textContent = String(item.qty);
      const plus = document.createElement("button");
      plus.type = "button";
      plus.dataset.qty = key;
      plus.dataset.delta = "1";
      plus.setAttribute("aria-label", "Add one");
      plus.textContent = "+";
      quantity.append(minus, amount, plus);
    }
    details.append(name, unit, quantity);
    if (!preorder) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.dataset.remove = key;
      remove.textContent = "Remove dish";
      remove.style.cssText =
        "margin-top:8px;border:0;background:transparent;color:#a13b2a;font-weight:700;text-decoration:underline;cursor:pointer;padding:4px 0";
      details.append(remove);
    }
    const line = document.createElement("strong");
    line.textContent = money(food.price * Number(item.qty));
    row.append(details, line);
    root.append(row);
  });
  const total = document.createElement("div");
  total.className = "cart-total";
  const label = document.createElement("span");
  label.textContent = "Subtotal";
  const amount = document.createElement("span");
  amount.textContent = money(subtotal);
  total.append(label, amount);
  root.append(total);
  const help = document.createElement("p");
  help.className = "cart-help";
  help.textContent =
    "Delivery fee is calculated after your address is entered. Checkout does not process payment.";
  const checkout = document.createElement("a");
  checkout.className = "btn";
  checkout.href = "checkout.html";
  checkout.style.width = "100%";
  checkout.textContent = "Continue to checkout ↗";
  root.append(help, checkout);
}
function openCart() {
  document.getElementById("cartDrawer")?.classList.add("open");
  document.body.style.overflow = "hidden";
  renderCart();
}
function closeCart() {
  document.getElementById("cartDrawer")?.classList.remove("open");
  document.body.style.overflow = "";
}
function boot() {
  const root = document.getElementById("siteHeader");
  if (root) {
    root.innerHTML = header();
    if (page === "restaurant-dashboard") {
      const bagButton = root.querySelector("[data-cart-open]");
      if (bagButton) {
        const notification = document.createElement("div");
        notification.className = "restaurant-notification";
        notification.innerHTML =
          '<button type="button" class="restaurant-notification-button" id="restaurantNotificationButton" aria-label="Notifications" aria-expanded="false"><span aria-hidden="true">🔔</span><span class="restaurant-notification-dot" id="restaurantNotificationDot" hidden></span></button><div class="restaurant-notification-dropdown" id="restaurantNotificationDropdown" hidden><div class="restaurant-notification-heading">Recent activity</div><div id="restaurantNotificationItems"><p class="restaurant-notification-empty">No recent orders or pre-orders.</p></div></div>';
        bagButton.replaceWith(notification);
      }
    }
  }
  const foot = document.getElementById("siteFooter");
  if (foot) foot.innerHTML = footer();
  if (page !== "restaurant-dashboard" && !document.getElementById("cartDrawer"))
    document.body.insertAdjacentHTML("beforeend", drawer());
  renderCart();
  document.getElementById("menuToggle")?.addEventListener("click", () => {
    const n = document.getElementById("navLinks");
    const open = n.classList.toggle("open");
    document
      .getElementById("menuToggle")
      .setAttribute("aria-expanded", String(open));
    document.getElementById("menuToggle").textContent = open ? "✕" : "☰";
  });
  document.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) addToCart(Number(add.dataset.add));
    if (e.target.closest("[data-cart-open]")) openCart();
    if (e.target.closest("[data-cart-close]")) closeCart();
    if (e.target.id === "cartDrawer") closeCart();
    const qty = e.target.closest("[data-qty]");
    if (qty) changeQty(qty.dataset.qty, Number(qty.dataset.delta));
    const remove = e.target.closest("[data-remove]");
    if (remove) removeFromCart(remove.dataset.remove);
    const cat = e.target.closest("[data-category]");
    if (cat) {
      activeCategory = cat.dataset.category;
      document
        .querySelectorAll("[data-category]")
        .forEach((b) => b.classList.toggle("active", b === cat));
      renderFoodGrid("foodGrid");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCart();
  });
  const search = document.getElementById("foodSearch");
  search?.addEventListener("input", (e) => {
    searchTerm = e.target.value.toLowerCase().trim();
    renderFoodGrid("foodGrid");
  });
  renderFoodGrid("foodGrid", document.body.dataset.page === "home" ? 6 : null);
  const form = document.querySelector("[data-demo-form]");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg =
      form.dataset.success ||
      "Thanks! Your details have been captured in this demo.";
    toast(msg);
    let note = form.querySelector("[data-form-note]");
    if (note) note.textContent = msg;
    form.reset();
  });
  if (
    page !== "restaurant-dashboard" &&
    new URLSearchParams(location.search).get("checkout") === "1"
  )
    setTimeout(openCart, 250);
}
window.jovickSetMenu = function (items) {
  if (!Array.isArray(items)) return;
  FOOD.splice(0, FOOD.length, ...items);
  try {
    const savedCart = JSON.parse(localStorage.getItem("jovick-cart") || "[]");
    if (Array.isArray(savedCart)) cart = savedCart;
  } catch {
    cart = [];
  }
  cart = cart
    .filter(
      (item) =>
        (item?.preorderRequestId ||
          FOOD.some((food) => Number(food.id) === Number(item.id))) &&
        Number.isInteger(Number(item.qty)) &&
        Number(item.qty) > 0,
    )
    .map((item) =>
      item.preorderRequestId
        ? {
            ...item,
            qty: Number(item.qty),
            id: "preorder:" + item.preorderRequestId,
          }
        : { id: Number(item.id), qty: Number(item.qty) },
    );
  persist();
  renderFoodGrid("foodGrid", document.body.dataset.page === "home" ? 6 : null);
};

document.addEventListener("DOMContentLoaded", boot);
