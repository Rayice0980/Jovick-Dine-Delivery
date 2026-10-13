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
      return Array.isArray(items) ? items.filter((x) => (x.preorderRequestId || Number.isInteger(Number(x.id))) && Number.isInteger(Number(x.qty)) && Number(x.qty) > 0) : [];
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
      const food = item.preorderRequestId ? { name: item.name || "Accepted pre-order", price: Number(item.price || 0), restaurantName: item.restaurantName || "Accepting business" } : menuItems.get(Number(item.id));
      if (!food) return;
      const qty = Number(item.qty), line = food.price * qty;
      subtotal += line;
      const row = document.createElement("div"); row.className = "cart-item";
      const details = document.createElement("div");
      const name = document.createElement("strong"); name.textContent = food.name;
      const quantity = document.createElement("small"); quantity.textContent = "Qty: " + qty + (item.preorderRequestId ? " · Private pre-order for " + food.restaurantName : "");
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
      window.location.replace("login.html?next=checkout");
      return;
    }
    const [profileResult, menuResult] = await Promise.all([
      supabase.from("profiles").select("full_name, phone, account_type").eq("id", user.id).single(),
      supabase.rpc("get_public_available_menu")
    ]);
    if (profileResult.error) throw profileResult.error;
    if (menuResult.error) throw menuResult.error;
    if (profileResult.data.account_type !== "customer") throw new Error("Only customer accounts can place customer orders.");
    document.getElementById("checkoutName").value = profileResult.data.full_name || "";
    document.getElementById("checkoutPhone").value = profileResult.data.phone || "";
    document.getElementById("checkoutEmail").value = user.email || "";
    menuItems = new Map(menuResult.data.map((food) => [Number(food.id), { name: food.name, price: Number(food.price) }]));

    await syncAcceptedPreordersInBag(user.id);

    const requestedFor = document.getElementById("requestedFor");
    if (requestedFor) {
      const minTime = new Date(Date.now() + 15 * 60 * 1000);
      requestedFor.min = new Date(minTime.getTime() - minTime.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      requestedFor.max = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    renderSummary(menuItems);
  } catch (error) {
    showNote(error.message || "We couldn't prepare checkout. Please refresh and try again.", true);
    submitButton.disabled = true; return;
  }

  async function syncAcceptedPreordersInBag(customerId) {
    const { data: requestResult, error: requestError } = await supabase.rpc("get_my_preorder_bag");
    if (requestError) throw requestError;
    const requests = requestResult || [];
    let savedCart = [];
    try { const parsed = JSON.parse(localStorage.getItem("jovick-cart") || "[]"); savedCart = Array.isArray(parsed) ? parsed : []; } catch { savedCart = []; }
    const orderedIds = new Set(requests.filter((request) => request.status === "ordered").map((request) => String(request.request_id)));
    savedCart = savedCart.filter((item) => !item.preorderRequestId || !orderedIds.has(String(item.preorderRequestId)));
    requests.filter((request) => request.status === "accepted" && Number(request.accepted_price) > 0).forEach((request) => {
      const requestId = String(request.request_id);
      const privateItem = { id: "preorder:" + requestId, preorderRequestId: requestId, qty: Number(request.quantity), name: request.dish_name, price: Number(request.accepted_price), restaurantId: request.accepted_restaurant_id, restaurantName: request.restaurant_name || "Accepting business" };
      if (!Number.isInteger(privateItem.qty) || privateItem.qty < 1) return;
      const existing = savedCart.find((item) => String(item.preorderRequestId || "") === requestId);
      if (existing) Object.assign(existing, privateItem); else savedCart.push(privateItem);
    });
    localStorage.setItem("jovick-cart", JSON.stringify(savedCart));
    window.dispatchEvent(new CustomEvent("jovick:cart-updated", { detail: { source: "accepted-preorder" } }));
    return savedCart;
  }
  async function refreshAcceptedPreordersInCheckout() {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const user = sessionData.session?.user;
      if (!user) return;
      await syncAcceptedPreordersInBag(user.id);
      renderSummary(menuItems);
    } catch (error) {
      console.error("Accepted pre-orders could not be refreshed during checkout.", error);
    }
  }
  window.setInterval(() => {
    if (document.visibilityState === "visible") refreshAcceptedPreordersInCheckout();
  }, 30000);
  window.addEventListener("focus", refreshAcceptedPreordersInCheckout);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const items = cart();
    if (!items.length) { showNote("Your cart is empty. Please add a meal before placing your order.", true); return; }
    if (items.some((item) => item.preorderRequestId ? (!item.name || !Number(item.price)) : !menuItems.has(Number(item.id)))) {
      showNote("One or more meals are no longer available. Return to the menu and add them again.", true); return;
    }
    const values = new FormData(form);
    let idempotencyKey = sessionStorage.getItem("jovick-checkout-idempotency");
    if (!idempotencyKey) {
      idempotencyKey = crypto.randomUUID();
      sessionStorage.setItem("jovick-checkout-idempotency", idempotencyKey);
    }
    const requestedFor = values.get("requestedFor");
    const payload = {
      action: "create",
      idempotency_key: idempotencyKey,
      customer_name: String(values.get("name") || "").trim(),
      customer_phone: String(values.get("phone") || "").trim(),
      customer_email: String(values.get("email") || "").trim(),
      delivery_address: String(values.get("address") || "").trim(),
      delivery_area: String(values.get("area") || "").trim(),
      payment_method: String(values.get("payment") || "").trim(),
      delivery_notes: String(values.get("notes") || "").trim(),
      items: items.map((item) => item.preorderRequestId ? ({ preorder_request_id: item.preorderRequestId, qty: Number(item.qty) }) : ({ id: Number(item.id), qty: Number(item.qty) })),
      requested_for: requestedFor ? new Date(String(requestedFor)).toISOString() : null
    };
    submitButton.disabled = true; submitButton.setAttribute("aria-busy", "true");
    showNote("Checking prices and calculating your combined delivery quote…");
    try {
      const { data, error } = await supabase.functions.invoke("checkout-payments", { body: payload });
      if (error) throw error;
      if (payload.payment_method === "paystack") {
        if (!data?.authorization_url) throw new Error(data?.error || "The payment page could not be opened. Please try again.");
        showNote("Your checkout is ready. Opening Paystack securely…");
        window.location.assign(data.authorization_url);
        return;
      }
      const orders = Array.isArray(data?.orders) ? data.orders : [];
      if (!orders.length || orders.some(order => !order?.order_number)) {
        throw new Error("We couldn't confirm all order numbers. Check My Orders before trying again.");
      }
      localStorage.removeItem("jovick-cart");
      localStorage.removeItem("jovick-menu-cache");
      sessionStorage.removeItem("jovick-checkout-idempotency");
      form.reset();
      const success = document.createElement("div"); success.className = "order-success";
      const heading = document.createElement("h3"); heading.textContent = orders.length > 1 ? "Your orders have been received!" : "Your order has been received!";
      const amount = document.createElement("p");
      amount.textContent = "Combined checkout total: " + money(data.total);
      const delivery = document.createElement("p");
      delivery.textContent = "One combined delivery fee: " + money(data.delivery_fee);
      const status = document.createElement("p"); status.textContent = "Cash is due on delivery. Each business has its own order to confirm and prepare.";
      const orderList = document.createElement("ul");
      orders.forEach(order => {
        const item = document.createElement("li");
        item.textContent = (order.restaurant_name || "Business") + " — Order " + order.order_number + " — " + money(order.total) + " — Awaiting confirmation";
        orderList.append(item);
      });
      const schedule = requestedFor ? document.createElement("p") : null;
      if (schedule) schedule.textContent = "Requested time: " + new Date(String(requestedFor)).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
      const link = document.createElement("a"); link.className = "btn"; link.href = "dashboard.html#orders"; link.textContent = "View my orders";
      success.append(heading, amount, delivery, status, orderList);
      if (schedule) success.append(schedule);
      success.append(link); summary.replaceChildren(success);
      showNote(orders.length > 1
        ? "Your checkout succeeded. Separate orders were sent to " + orders.length + " businesses."
        : "Order saved successfully. You can view it from your customer dashboard.");
    } catch (error) {
      showNote(error.message || "We couldn't place your order. Your cart is still saved; please try again.", true);
    } finally { submitButton.disabled = false; submitButton.removeAttribute("aria-busy"); }
  });
});
