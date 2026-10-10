import { supabase, supabaseConfigured } from "./supabase-client.js";

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("checkoutForm");
  const summary = document.getElementById("checkoutSummary");
  const note = document.getElementById("checkoutNote");
  const submitButton = document.getElementById("placeOrderButton");
  const money = (value) => "₦" + Number(value).toLocaleString("en-NG");
  const cart = () => {
    try {
      const items = JSON.parse(localStorage.getItem("jovick-cart") || "[]");
      return Array.isArray(items) ? items.filter((x) => Number.isInteger(Number(x.id)) && Number(x.qty) > 0) : [];
    } catch { return []; }
  };
  function showNote(text, isError = false) {
    note.textContent = text;
    note.classList.toggle("is-error", isError);
    note.hidden = false;
  }
  function renderSummary(menuItems) {
    const items = cart();
    summary.replaceChildren();
    if (!items.length) {
      const p = document.createElement("p");
      p.append(document.createTextNode("Your bag is empty. "));
      const link = document.createElement("a");
      link.className = "text-link"; link.href = "foods.html"; link.textContent = "Browse the menu";
      p.append(link); summary.append(p); submitButton.disabled = true; return;
    }
    let subtotal = 0;
    items.forEach((item) => {
      const food = menuItems.get(Number(item.id));
      if (!food) return;
      const qty = Number(item.qty), line = food.price * qty;
      subtotal += line;
      const row = document.createElement("div"); row.className = "cart-item";
      const details = document.createElement("div");
      const name = document.createElement("strong"); name.textContent = food.name;
      const quantity = document.createElement("small"); quantity.textContent = "Qty: " + qty;
      details.append(name, quantity);
      const price = document.createElement("strong"); price.textContent = money(line);
      row.append(details, price); summary.append(row);
    });
    const total = document.createElement("div"); total.className = "cart-total";
    const label = document.createElement("span"); label.textContent = "Subtotal";
    const amount = document.createElement("strong"); amount.textContent = money(subtotal);
    total.append(label, amount); summary.append(total);
    if (!subtotal) { submitButton.disabled = true; showNote("Your cart items could not be matched to the current menu. Return to the menu and add them again.", true); }
  }

  if (!supabaseConfigured || !supabase) {
    showNote("Ordering is temporarily unavailable because the database connection is not configured.", true);
    submitButton.disabled = true; return;
  }
  let menuItems = new Map();
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData.session?.user;
    if (!user) {
      showNote("Please sign in to place an order. Your cart will stay saved on this device.", true);
      const link = document.createElement("a"); link.className = "text-link"; link.href = "login.html?next=checkout"; link.textContent = " Sign in to continue"; note.append(link);
      submitButton.disabled = true;
      form.querySelectorAll("input, select, textarea, button[type=submit]").forEach((el) => { el.disabled = true; });
      return;
    }
    const [profileResult, menuResult] = await Promise.all([
      supabase.from("profiles").select("full_name, phone, account_type").eq("id", user.id).single(),
      supabase.from("menu_items").select("id, name, price").eq("is_available", true)
    ]);
    if (profileResult.error) throw profileResult.error;
    if (menuResult.error) throw menuResult.error;
    if (profileResult.data.account_type !== "customer") throw new Error("Only customer accounts can place customer orders.");
    document.getElementById("checkoutName").value = profileResult.data.full_name || "";
    document.getElementById("checkoutPhone").value = profileResult.data.phone || "";
    document.getElementById("checkoutEmail").value = user.email || "";
    menuItems = new Map(menuResult.data.map((food) => [Number(food.id), { name: food.name, price: Number(food.price) }]));
    renderSummary(menuItems);
  } catch (error) {
    showNote(error.message || "We couldn't prepare checkout. Please refresh and try again.", true);
    submitButton.disabled = true; return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const items = cart();
    if (!items.length) { showNote("Your cart is empty. Please add a meal before placing your order.", true); return; }
    if (items.some((item) => !menuItems.has(Number(item.id)))) {
      showNote("One or more meals are no longer available. Return to the menu and add them again.", true); return;
    }
    const values = new FormData(form);
    const payload = {
      p_customer_name: String(values.get("name") || "").trim(),
      p_customer_phone: String(values.get("phone") || "").trim(),
      p_customer_email: String(values.get("email") || "").trim(),
      p_delivery_address: String(values.get("address") || "").trim(),
      p_delivery_area: String(values.get("area") || "").trim(),
      p_payment_method: String(values.get("payment") || "").trim(),
      p_delivery_notes: String(values.get("notes") || "").trim(),
      p_items: items.map((item) => ({ id: Number(item.id), qty: Number(item.qty) }))
    };
    submitButton.disabled = true; submitButton.setAttribute("aria-busy", "true");
    showNote("Submitting your order securely…");
    try {
      const { data, error } = await supabase.rpc("place_customer_order", payload);
      if (error) throw error;
      const order = Array.isArray(data) ? data[0] : data;
      if (!order?.order_number) throw new Error("We couldn't confirm the order number. Check My Orders before trying again.");
      localStorage.removeItem("jovick-cart");
      localStorage.removeItem("jovick-menu-cache");
      form.reset();
      const success = document.createElement("div"); success.className = "order-success";
      const heading = document.createElement("h3"); heading.textContent = "Your order has been received!";
      const number = document.createElement("p"); number.textContent = "Order number: " + order.order_number;
      const amount = document.createElement("p"); amount.textContent = "Order total: " + money(order.total);
      const status = document.createElement("p"); status.textContent = "Status: Received. Payment has not been processed.";
      const link = document.createElement("a"); link.className = "btn"; link.href = "dashboard.html#orders"; link.textContent = "View my orders";
      success.append(heading, number, amount, status, link); summary.replaceChildren(success);
      showNote("Order saved successfully. You can view it from your customer dashboard.");
    } catch (error) {
      showNote(error.message || "We couldn't place your order. Your cart is still saved; please try again.", true);
    } finally { submitButton.disabled = false; submitButton.removeAttribute("aria-busy"); }
  });
});
