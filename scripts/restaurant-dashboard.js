import { supabase, supabaseConfigured } from "./supabase-client.js";

document.addEventListener("DOMContentLoaded", async () => {
  const notice = document.getElementById("restaurantNotice");
  const menuList = document.getElementById("menuList");
  const ordersList = document.getElementById("restaurantOrders");
  const menuForm = document.getElementById("menuForm");
  const saveMenuButton = document.getElementById("saveMenuButton");
  const menuFeedback = document.getElementById("menuFeedback");
  const cancelEditButton = document.getElementById("cancelEditButton");
  let user = null;
  let restaurant = null;
  let menuItems = [];

  const money = (value) => "₦" + Number(value || 0).toLocaleString("en-NG");
  const statusLabels = { received:"Received", confirmed:"Confirmed", preparing:"Preparing", out_for_delivery:"Out for delivery", delivered:"Delivered", cancelled:"Cancelled" };

  function showNotice(text, error = false) {
    notice.textContent = text;
    notice.hidden = false;
    notice.classList.toggle("is-error", error);
  }
  function setMenuFeedback(text, error = false) {
    menuFeedback.textContent = text;
    menuFeedback.classList.toggle("is-error", error);
  }
  function safeElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function resetMenuForm() {
    menuForm.reset();
    document.getElementById("menuItemId").value = "";
    saveMenuButton.textContent = "Add menu item ↗";
    cancelEditButton.hidden = true;
    setMenuFeedback("");
  }

  if (!supabaseConfigured || !supabase) {
    showNotice("Restaurant services are not configured. Please try again later.", true);
    menuForm.hidden = true;
    return;
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    user = sessionData.session?.user;
    if (!user) {
      window.location.replace("login.html?next=restaurant");
      return;
    }

    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("account_type,full_name").eq("id", user.id).single();
    if (profileError) throw profileError;
    if (profile.account_type !== "restaurant") {
      window.location.replace("dashboard.html");
      return;
    }

    const { data: restaurantData, error: restaurantError } = await supabase.from("restaurants")
      .select("id,name,business_type,business_address,status").eq("owner_id", user.id).maybeSingle();
    if (restaurantError) throw restaurantError;
    restaurant = restaurantData;
    if (!restaurant) {
      showNotice("We couldn't find a restaurant profile linked to this account. Please contact support.", true);
      menuForm.hidden = true;
      return;
    }
    document.getElementById("restaurantHeading").textContent = restaurant.name || profile.full_name || "Your restaurant dashboard";

    if (restaurant.status !== "approved") {
      showNotice("Your restaurant account is " + restaurant.status + ". Menu editing and order management unlock after an administrator approves your business. You can sign out using the site menu.", false);
      menuForm.hidden = true;
      menuList.replaceChildren(safeElement("p", "empty-state", "Your restaurant menu will appear here after approval."));
      ordersList.replaceChildren(safeElement("p", "empty-state", "Incoming orders will appear here after approval."));
      document.getElementById("menuCount").textContent = "—";
      document.getElementById("availableCount").textContent = "—";
      document.getElementById("ordersCount").textContent = "—";
      return;
    }

    await loadMenu();
    await loadOrders();
  } catch (error) {
    showNotice(error.message || "We couldn't load your restaurant workspace. Please refresh and try again.", true);
  }

  async function loadMenu() {
    const { data, error } = await supabase.from("menu_items")
      .select("id,slug,name,category,price,description,image_url,is_available,tag")
      .eq("restaurant_id", restaurant.id).order("sort_order", { ascending: true }).order("name");
    if (error) throw error;
    menuItems = data || [];
    document.getElementById("menuCount").textContent = String(menuItems.length);
    document.getElementById("availableCount").textContent = String(menuItems.filter(item => item.is_available).length);
    menuList.replaceChildren();
    if (!menuItems.length) {
      menuList.append(safeElement("p", "empty-state", "No restaurant-specific dishes yet. Use the form above to add your first menu item."));
      return;
    }
    menuItems.forEach(item => {
      const card = safeElement("article", "managed-menu-card");
      const top = safeElement("div", "managed-menu-top");
      const copy = document.createElement("div");
      copy.append(safeElement("span", "menu-category-label", item.category));
      copy.append(safeElement("h3", "", item.name));
      copy.append(safeElement("p", "", item.description || "No description added."));
      top.append(copy, safeElement("strong", "menu-price", money(item.price)));
      const actions = safeElement("div", "menu-card-actions");
      const status = safeElement("span", "availability" + (item.is_available ? "" : " off"), item.is_available ? "Available" : "Paused");
      const buttons = document.createElement("div");
      const edit = safeElement("button", "", "Edit details");
      edit.type = "button";
      edit.addEventListener("click", () => {
        document.getElementById("menuItemId").value = String(item.id);
        document.getElementById("menuName").value = item.name;
        document.getElementById("menuCategory").value = item.category;
        document.getElementById("menuPrice").value = String(item.price);
        document.getElementById("menuImage").value = item.image_url || "";
        document.getElementById("menuDescription").value = item.description || "";
        saveMenuButton.textContent = "Save menu changes ↗";
        cancelEditButton.hidden = false;
        setMenuFeedback("Editing " + item.name);
        menuForm.scrollIntoView({ behavior: "auto", block: "start" });
      });
      const toggle = safeElement("button", "", item.is_available ? "Pause item" : "Make available");
      toggle.type = "button";
      toggle.addEventListener("click", async () => {
        const previousAvailability = item.is_available;
        const nextAvailability = !previousAvailability;

        // Update the card immediately so the interface feels responsive.
        item.is_available = nextAvailability;
        status.textContent = nextAvailability ? "Available" : "Paused";
        status.classList.toggle("off", !nextAvailability);
        toggle.textContent = nextAvailability ? "Pause item" : "Make available";
        toggle.disabled = true;
        document.getElementById("availableCount").textContent = String(menuItems.filter(menuItem => menuItem.is_available).length);

        try {
          const { error } = await supabase.from("menu_items")
            .update({ is_available: nextAvailability })
            .eq("id", item.id)
            .eq("restaurant_id", restaurant.id);
          if (error) throw error;
          setMenuFeedback(item.name + (nextAvailability ? " is now available." : " is now paused."));
        } catch (error) {
          // Revert the optimistic update if the server rejects the change.
          item.is_available = previousAvailability;
          status.textContent = previousAvailability ? "Available" : "Paused";
          status.classList.toggle("off", !previousAvailability);
          toggle.textContent = previousAvailability ? "Pause item" : "Make available";
          document.getElementById("availableCount").textContent = String(menuItems.filter(menuItem => menuItem.is_available).length);
          showNotice(error.message || "Could not update item availability.", true);
        } finally {
          toggle.disabled = false;
        }
      });
      buttons.append(edit, toggle);
      actions.append(status, buttons);
      card.append(top, actions);
      menuList.append(card);
    });
  }

  async function loadOrders() {
    ordersList.replaceChildren(safeElement("p", "loading-copy", "Loading incoming orders…"));
    const { data: orders, error } = await supabase.from("orders")
      .select("id,order_number,customer_name,customer_phone,delivery_address,delivery_area,delivery_notes,payment_method,subtotal,delivery_fee,total,status,created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const orderIds = (orders || []).map(order => order.id);
    let lines = [];
    if (orderIds.length) {
      const { data, error: linesError } = await supabase.from("order_items")
        .select("order_id,item_name,quantity,unit_price,line_total,menu_item_id").in("order_id", orderIds);
      if (linesError) throw linesError;
      lines = data || [];
    }
    ordersList.replaceChildren();
    document.getElementById("ordersCount").textContent = String((orders || []).length);
    if (!orders?.length) {
      ordersList.append(safeElement("p", "empty-state", "No incoming orders yet. Orders for your restaurant will appear here."));
      return;
    }
    const availableOrders = orders.filter(order => lines.some(line => line.order_id === order.id && menuItems.some(item => String(item.id) === String(line.menu_item_id))));
    document.getElementById("ordersCount").textContent = String(availableOrders.length);
    if (!availableOrders.length) {
      ordersList.append(safeElement("p", "empty-state", "No incoming orders for your menu yet."));
      return;
    }
    availableOrders.forEach(order => {
      const card = safeElement("article", "restaurant-order-card");
      const head = safeElement("div", "restaurant-order-head");
      const copy = document.createElement("div");
      copy.append(safeElement("h3", "", order.order_number));
      copy.append(safeElement("p", "", new Date(order.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })));
      head.append(copy, safeElement("span", "order-status-pill", statusLabels[order.status] || order.status));
      card.append(head);
      card.append(safeElement("p", "order-meta", "Customer: " + order.customer_name + " · " + order.customer_phone));
      card.append(safeElement("p", "order-meta", "Delivery: " + order.delivery_address + ", " + order.delivery_area));
      if (order.delivery_notes) card.append(safeElement("p", "order-meta", "Note: " + order.delivery_notes));
      const list = safeElement("ul", "restaurant-order-lines");
      lines.filter(line => line.order_id === order.id).forEach(line => {
        const li = document.createElement("li");
        li.append(safeElement("span", "", line.item_name + " × " + line.quantity));
        li.append(safeElement("strong", "", money(line.line_total)));
        list.append(li);
      });
      card.append(list);
      const footer = safeElement("div", "restaurant-order-footer");
      const payment = safeElement("span", "order-meta", "Payment preference: " + order.payment_method);
      footer.append(payment, safeElement("strong", "", "Total " + money(order.total)));
      const statusSelect = document.createElement("select");
      statusSelect.setAttribute("aria-label", "Update status for " + order.order_number);
      [["received","Received"],["confirmed","Confirmed"],["preparing","Preparing"],["out_for_delivery","Out for delivery"],["delivered","Delivered"],["cancelled","Cancelled"]].forEach(([value,label]) => {
        const option = document.createElement("option"); option.value = value; option.textContent = label; option.selected = value === order.status; statusSelect.append(option);
      });
      statusSelect.addEventListener("change", async () => {
        statusSelect.disabled = true;
        try {
          const { error } = await supabase.rpc("restaurant_update_order_status", { p_order_id: order.id, p_status: statusSelect.value });
          if (error) throw error;
          await loadOrders();
        } catch (error) {
          showNotice(error.message || "Could not update order status.", true);
          statusSelect.disabled = false;
          statusSelect.value = order.status;
        }
      });
      footer.append(statusSelect);
      card.append(footer);
      ordersList.append(card);
    });
  }

  menuForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!restaurant || restaurant.status !== "approved") return;
    const name = document.getElementById("menuName").value.trim();
    const category = document.getElementById("menuCategory").value;
    const price = Number(document.getElementById("menuPrice").value);
    const description = document.getElementById("menuDescription").value.trim();
    const image_url = document.getElementById("menuImage").value.trim();
    const editingId = document.getElementById("menuItemId").value;
    if (!name || !Number.isSafeInteger(price) || price <= 0) {
      setMenuFeedback("Enter a dish name and a valid whole-number price.", true);
      return;
    }
    saveMenuButton.disabled = true;
    setMenuFeedback(editingId ? "Saving menu changes…" : "Adding menu item…");
    try {
      const payload = { name, category, price, description, image_url, restaurant_id: restaurant.id };
      if (editingId) {
        const { error } = await supabase.from("menu_items").update(payload).eq("id", Number(editingId)).eq("restaurant_id", restaurant.id);
        if (error) throw error;
      } else {
        const slugBase = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70) || "menu-item";
        payload.slug = slugBase + "-" + Math.random().toString(36).slice(2, 8);
        payload.tag = "Restaurant special";
        payload.rating = 4.7;
        payload.sort_order = 100;
        payload.is_available = true;
        const { error } = await supabase.from("menu_items").insert(payload);
        if (error) throw error;
      }
      resetMenuForm();
      setMenuFeedback(editingId ? "Menu item updated." : "Menu item added.");
      await loadMenu();
    } catch (error) {
      setMenuFeedback(error.message || "Could not save this menu item.", true);
    } finally {
      saveMenuButton.disabled = false;
    }
  });
  cancelEditButton.addEventListener("click", resetMenuForm);
});