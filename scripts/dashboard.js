import { supabase, supabaseConfigured } from "./supabase-client.js";

document.addEventListener("DOMContentLoaded", async () => {
  const message = document.getElementById("dashboardMessage");
  const profileForm = document.getElementById("profileForm");
  const saveButton = document.getElementById("saveProfileButton");
  const feedback = document.getElementById("profileFeedback");
  const signOutButton = document.getElementById("signOutButton");
  let currentUser = null;


  async function loadOrders(customerId) {
    const container = document.getElementById("ordersList");
    const count = document.getElementById("orderCount");
    if (!container) return;
    container.replaceChildren();
    const loading = document.createElement("p");
    loading.textContent = "Loading your orders…";
    container.append(loading);
    try {
      const { data: orders, error } = await supabase.from("orders")
        .select("id, order_number, status, total, delivery_area, created_at, requested_for")
        .eq("customer_id", customerId).order("created_at", { ascending: false });
      if (error) throw error;
      container.replaceChildren();
      if (count) count.textContent = String((orders || []).length);
      const bigNumber = document.querySelector(".order-count-card .big-number");
      const description = document.querySelector(".order-count-card p");
      if (bigNumber) bigNumber.textContent = String((orders || []).length);
      if (description) description.textContent = (orders || []).length === 1 ? "1 order saved to your account." : (orders || []).length + " orders saved to your account.";
      if (!orders?.length) {
        const empty = document.createElement("div"); empty.className = "orders-empty";
        const icon = document.createElement("div"); icon.className = "empty-illustration"; icon.textContent = "🥡";
        const title = document.createElement("h3"); title.textContent = "Your table is waiting";
        const copy = document.createElement("p"); copy.textContent = "Your submitted orders will appear here.";
        const link = document.createElement("a"); link.className = "btn"; link.href = "foods.html"; link.textContent = "Explore the menu ↗";
        empty.append(icon, title, copy, link); container.append(empty); return;
      }
      const { data: lines, error: linesError } = await supabase.from("order_items")
        .select("order_id, item_name, quantity, line_total").in("order_id", orders.map((o) => o.id));
      if (linesError) throw linesError;
      const money = (v) => "₦" + Number(v).toLocaleString("en-NG");
      const statusLabels = { received: "Awaiting confirmation", confirmed: "Confirmed", preparing: "Being prepared", out_for_delivery: "Out for delivery", delivered: "Delivered", cancelled: "Cancelled" };
      orders.forEach((order) => {
        const card = document.createElement("article"); card.className = "order-history-card";
        const header = document.createElement("div"); header.className = "order-history-header";
        const info = document.createElement("div");
        const title = document.createElement("h3"); title.textContent = order.order_number;
        const date = document.createElement("p"); date.textContent = new Date(order.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
        info.append(title, date);
        const badge = document.createElement("span"); badge.className = "order-status order-status-" + order.status; badge.textContent = statusLabels[order.status] || order.status;
        header.append(info, badge); card.append(header);
        const list = document.createElement("ul"); list.className = "order-history-items";
        (lines || []).filter((line) => Number(line.order_id) === Number(order.id)).forEach((line) => {
          const li = document.createElement("li"); const itemName = document.createElement("span"); itemName.textContent = line.item_name + " × " + line.quantity;
          const price = document.createElement("strong"); price.textContent = money(line.line_total); li.append(itemName, price); list.append(li);
        });
        card.append(list);
        if (order.requested_for) { const schedule = document.createElement("p"); schedule.className = "order-meta"; schedule.textContent = "Requested time: " + new Date(order.requested_for).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }); card.append(schedule); }
        const footer = document.createElement("div"); footer.className = "order-history-footer";
        const area = document.createElement("span"); area.textContent = "Delivery: " + order.delivery_area;
        const total = document.createElement("strong"); total.textContent = "Total " + money(order.total);
        footer.append(area, total); card.append(footer); container.append(card);
      });
    } catch (error) {
      container.replaceChildren();
      const err = document.createElement("p"); err.className = "orders-list-empty is-error";
      err.textContent = error.message || "We couldn't load your orders. Please refresh."; container.append(err);
    }
  }

  async function syncAcceptedPreorders(customerId) {
    const ordersContainer = document.getElementById("ordersList");
    if (!ordersContainer) return;
    try {
      const [menuResult, requestsResult] = await Promise.all([
        supabase.rpc("get_public_available_menu"),
        supabase.from("dish_preorder_requests")
          .select("id,dish_name,quantity,accepted_menu_item_id,accepted_at")
          .eq("customer_id", customerId)
          .eq("status", "accepted")
          .not("accepted_menu_item_id", "is", null)
          .order("accepted_at", { ascending: false })
      ]);
      if (menuResult.error) throw menuResult.error;
      if (requestsResult.error) throw requestsResult.error;
      const menu = Array.isArray(menuResult.data) ? menuResult.data : [];
      const accepted = requestsResult.data || [];
      let processed = [];
      let cart = [];
      try {
        processed = JSON.parse(localStorage.getItem("jovick-accepted-preorder-ids") || "[]");
        cart = JSON.parse(localStorage.getItem("jovick-cart") || "[]");
        if (!Array.isArray(processed)) processed = [];
        if (!Array.isArray(cart)) cart = [];
      } catch {
        processed = [];
        cart = [];
      }
      const processedSet = new Set(processed.map(String));
      let changed = false;

      // Automatically place newly accepted requests in the bag. If an earlier
      // attempt marked one as processed but the bag is now missing it, the
      // customer gets an explicit recovery button below instead of losing it.
      accepted.forEach(request => {
        const requestId = String(request.id);
        const itemId = Number(request.accepted_menu_item_id);
        const quantity = Number(request.quantity);
        if (processedSet.has(requestId) || !menu.some(item => Number(item.id) === itemId) ||
            !Number.isInteger(quantity) || quantity < 1) return;
        const existing = cart.find(item => Number(item.id) === itemId);
        if (existing) existing.qty = Number(existing.qty) + quantity;
        else cart.push({ id: itemId, qty: quantity });
        processedSet.add(requestId);
        changed = true;
      });
      if (changed) {
        localStorage.setItem("jovick-cart", JSON.stringify(cart));
        localStorage.setItem("jovick-accepted-preorder-ids", JSON.stringify(Array.from(processedSet)));
      }

      let panel = document.getElementById("acceptedPreordersPanel");
      if (!panel) {
        panel = document.createElement("section");
        panel.id = "acceptedPreordersPanel";
        panel.className = "dashboard-panel";
        const ordersSection = document.getElementById("orders");
        if (ordersSection?.parentNode) ordersSection.parentNode.insertBefore(panel, ordersSection);
      }
      panel.replaceChildren();
      const heading = document.createElement("h2");
      heading.textContent = "Accepted pre-orders";
      panel.append(heading);
      if (!accepted.length) {
        const empty = document.createElement("p");
        empty.textContent = "Accepted pre-orders will appear here when a restaurant agrees to prepare a requested dish.";
        panel.append(empty);
        return;
      }
      accepted.forEach(request => {
        const itemId = Number(request.accepted_menu_item_id);
        const food = menu.find(item => Number(item.id) === itemId);
        const card = document.createElement("article");
        card.className = "order-history-card";
        const title = document.createElement("h3");
        title.textContent = food?.name || request.dish_name || "Accepted dish";
        const details = document.createElement("p");
        details.textContent = "Quantity: " + Number(request.quantity) + (food ? " · Price per item: ₦" + Number(food.price).toLocaleString("en-NG") : "");
        card.append(title, details);
        const currentlyInBag = cart.some(item => Number(item.id) === itemId);
        if (currentlyInBag) {
          const status = document.createElement("p");
          status.textContent = "This accepted dish is in your bag.";
          card.append(status);
        } else {
          const add = document.createElement("button");
          add.type = "button";
          add.className = "btn";
          add.textContent = "Add accepted dish to bag";
          add.addEventListener("click", () => {
            if (!food) {
              showMessage("This accepted dish is no longer on the available menu. Please contact the restaurant.", true);
              return;
            }
            let currentCart = [];
            try {
              currentCart = JSON.parse(localStorage.getItem("jovick-cart") || "[]");
              if (!Array.isArray(currentCart)) currentCart = [];
            } catch { currentCart = []; }
            const existing = currentCart.find(item => Number(item.id) === itemId);
            if (existing) existing.qty = Number(existing.qty) + Number(request.quantity);
            else currentCart.push({ id: itemId, qty: Number(request.quantity) });
            const currentProcessed = new Set(processedSet);
            currentProcessed.add(String(request.id));
            localStorage.setItem("jovick-cart", JSON.stringify(currentCart));
            localStorage.setItem("jovick-accepted-preorder-ids", JSON.stringify(Array.from(currentProcessed)));
            showMessage("Accepted dish added to your bag. Open the menu to review it and complete checkout.");
            add.disabled = true;
            add.textContent = "Added to bag";
          });
          card.append(add);
        }
        const link = document.createElement("a");
        link.href = "foods.html";
        link.className = "text-link";
        link.textContent = "Open menu and checkout";
        card.append(link);
        panel.append(card);
      });
    } catch (error) {
      showMessage("Accepted pre-orders could not be synced: " + (error.message || "Please refresh and try again."), true);
    }
  }

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.hidden = false;
    message.classList.toggle("is-error", isError);
  }

  function showFeedback(text, isError = false) {
    feedback.textContent = text;
    feedback.classList.toggle("is-error", isError);
  }

  if (!supabaseConfigured || !supabase) {
    showMessage("Account services are not configured. Please try again later.", true);
    if (profileForm) profileForm.hidden = true;
    return;
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    currentUser = sessionData.session?.user || null;

    if (!currentUser) {
      window.location.replace("login.html?next=dashboard");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, phone, account_type")
      .eq("id", currentUser.id)
      .single();

    if (profileError) throw profileError;

    if (profile.account_type !== "customer") {
      showMessage("This is the customer dashboard. Your account is registered as a restaurant business. Please use the restaurant sign-in option.", true);
      profileForm.hidden = true;
      return;
    }

    await syncAcceptedPreorders(currentUser.id);
    await loadOrders(currentUser.id);

    const fullName = profile.full_name || "Jovick customer";
    document.getElementById("welcomeName").textContent = "Hello, " + fullName.split(/\s+/)[0] + "!";
    document.getElementById("sidebarName").textContent = fullName;
    document.getElementById("customerAvatar").textContent = fullName.trim().charAt(0).toUpperCase() || "J";
    document.getElementById("profileFullName").value = profile.full_name || "";
    document.getElementById("profilePhone").value = profile.phone || "";
    document.getElementById("profileEmail").value = currentUser.email || "";
  } catch (error) {
    showMessage(error.message || "We couldn't load your account. Please refresh and try again.", true);
  }

  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser) return;

    const fullName = document.getElementById("profileFullName").value.trim();
    const phone = document.getElementById("profilePhone").value.trim();
    if (!fullName) {
      showFeedback("Please enter your full name.", true);
      return;
    }

    saveButton.disabled = true;
    saveButton.setAttribute("aria-busy", "true");
    showFeedback("Saving your changes…");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone })
        .eq("id", currentUser.id);
      if (error) throw error;

      document.getElementById("welcomeName").textContent = "Hello, " + fullName.split(/\s+/)[0] + "!";
      document.getElementById("sidebarName").textContent = fullName;
      document.getElementById("customerAvatar").textContent = fullName.trim().charAt(0).toUpperCase() || "J";
      showFeedback("Your profile has been updated.");
    } catch (error) {
      showFeedback(error.message || "We couldn't save your changes. Please try again.", true);
    } finally {
      saveButton.disabled = false;
      saveButton.removeAttribute("aria-busy");
    }
  });

  signOutButton?.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.replace("login.html?signedout=1");
    } catch (error) {
      showMessage(error.message || "Sign-out failed. Please try again.", true);
      signOutButton.disabled = false;
    }
  });
});
