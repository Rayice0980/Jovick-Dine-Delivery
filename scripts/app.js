const FOOD = [
  {
    id: 1,
    name: "Jollof Rice & Grilled Chicken",
    category: "Rice",
    price: 6500,
    rating: "4.9",
    tag: "Customer favourite",
    desc: "Smoky party-style jollof, juicy grilled chicken and plantain.",
    image:
      "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 2,
    name: "Egusi & Pounded Yam",
    category: "Swallow",
    price: 5500,
    rating: "4.8",
    tag: "Local classic",
    desc: "Rich melon-seed soup with assorted meat and soft pounded yam.",
    image:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 3,
    name: "Suya Beef Bowl",
    category: "Grills",
    price: 4800,
    rating: "4.8",
    tag: "Spicy & smoky",
    desc: "Char-grilled beef suya, onions, fresh tomatoes and pepper sauce.",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 4,
    name: "Ofada Rice & Ayamase",
    category: "Rice",
    price: 6200,
    rating: "4.9",
    tag: "House special",
    desc: "Local ofada rice with bold green pepper sauce and assorted meat.",
    image:
      "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 5,
    name: "Peppered Chicken Wings",
    category: "Grills",
    price: 5200,
    rating: "4.7",
    tag: "Crowd pleaser",
    desc: "Crispy wings tossed in a sweet, savoury Nigerian pepper glaze.",
    image:
      "https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 6,
    name: "Beans & Fried Plantain",
    category: "Everyday",
    price: 3200,
    rating: "4.7",
    tag: "Comfort food",
    desc: "Slow-cooked beans served with golden ripe plantain.",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 7,
    name: "Yam & Egg Sauce",
    category: "Everyday",
    price: 2800,
    rating: "4.6",
    tag: "Breakfast pick",
    desc: "Soft boiled yam with fresh tomato, pepper and egg sauce.",
    image:
      "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 8,
    name: "Catfish Pepper Soup",
    category: "Soups",
    price: 7000,
    rating: "4.8",
    tag: "Weekend favourite",
    desc: "Fragrant, warming pepper soup with fresh catfish and herbs.",
    image:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 9,
    name: "Puff-Puff (6 pieces)",
    category: "Sides",
    price: 1500,
    rating: "4.6",
    tag: "Sweet treat",
    desc: "Freshly fried golden puff-puff, light on the inside.",
    image:
      "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=900&q=85",
  },
];
const money = (n) => "₦" + Number(n).toLocaleString("en-NG");
let cart = JSON.parse(localStorage.getItem("jovick-cart") || "[]"),
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
    '<a href="faq.html">FAQs</a></nav><div class="nav-actions"><button class="cart-btn" data-cart-open aria-label="Open shopping cart">Bag <span class="cart-count" id="cartCount">' +
    cart.reduce((s, i) => s + i.qty, 0) +
    '</span></button><a class="btn" href="foods.html">Order food ↗</a><button class="menu-toggle" id="menuToggle" aria-label="Toggle navigation" aria-expanded="false">☰</button></div></div></header>'
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
    '</h3><span class="food-rating">★ ' +
    f.rating +
    '</span></div><p class="food-description">' +
    f.desc +
    '</p><div class="food-bottom"><span class="price">' +
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
    : "<p>No dishes found. Try another search or category.</p>";
}
function persist() {
  localStorage.setItem("jovick-cart", JSON.stringify(cart));
  document
    .querySelectorAll("#cartCount")
    .forEach((e) => (e.textContent = cart.reduce((s, i) => s + i.qty, 0)));
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
  const item = cart.find((x) => x.id === id);
  if (item) item.qty++;
  else cart.push({ id, qty: 1 });
  persist();
  toast(f.name + " added to your bag");
}
function changeQty(id, d) {
  const i = cart.find((x) => x.id === id);
  if (!i) return;
  i.qty += d;
  if (i.qty <= 0) cart = cart.filter((x) => x.id !== id);
  persist();
}
function renderCart() {
  const el = document.getElementById("cartContents");
  if (!el) return;
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const subtotal = cart.reduce(
    (s, i) => s + i.qty * FOOD.find((f) => f.id === i.id).price,
    0,
  );
  document.getElementById("cartCountHeading").textContent = count
    ? "(" + count + ")"
    : "";
  if (!cart.length) {
    el.innerHTML =
      '<div class="empty-cart"><span>🥡</span><h3>Your bag is taking a break</h3><p>Add a few favourites and we’ll get things ready.</p><a class="btn" href="foods.html">Explore the menu</a></div>';
    return;
  }
  el.innerHTML =
    cart
      .map((i) => {
        const f = FOOD.find((x) => x.id === i.id);
        return (
          '<div class="cart-item"><div><strong>' +
          f.name +
          "</strong><small>" +
          money(f.price) +
          ' each</small><div class="quantity"><button data-qty="' +
          i.id +
          '" data-delta="-1" aria-label="Remove one">−</button><span>' +
          i.qty +
          '</span><button data-qty="' +
          i.id +
          '" data-delta="1" aria-label="Add one">+</button></div></div><strong>' +
          money(f.price * i.qty) +
          "</strong></div>"
        );
      })
      .join("") +
    '<div class="cart-total"><span>Subtotal</span><span>' +
    money(subtotal) +
    '</span></div><p class="cart-help">Delivery fee is calculated after your address is entered. Checkout here is a demo and does not process payment.</p><a class="btn" style="width:100%" href="checkout.html">Continue to checkout ↗</a>';
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
  if (root) root.innerHTML = header();
  const foot = document.getElementById("siteFooter");
  if (foot) foot.innerHTML = footer();
  if (!document.getElementById("cartDrawer"))
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
    if (qty) changeQty(Number(qty.dataset.qty), Number(qty.dataset.delta));
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
  if (new URLSearchParams(location.search).get("checkout") === "1")
    setTimeout(openCart, 250);
}
window.jovickSetMenu = function (items) {
  if (!Array.isArray(items) || !items.length) return;
  FOOD.splice(0, FOOD.length, ...items);
  cart = cart.filter((item) => FOOD.some((food) => food.id === item.id));
  persist();
  renderFoodGrid("foodGrid", document.body.dataset.page === "home" ? 6 : null);
};

document.addEventListener("DOMContentLoaded", boot);
