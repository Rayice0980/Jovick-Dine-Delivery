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
  let sharedDishes = [];
  let ownDishAvailability = [];
  let knownPreorderIds = null;

  const money = (value) => "₦" + Number(value || 0).toLocaleString("en-NG");
  // menu_items currently permits only the categories used by the customer menu filters.
  // Map broader catalogue categories into those supported groups before saving.
  function menuCategoryForDish(category) {
    const supported = ["Rice", "Swallow", "Grills", "Everyday", "Soups", "Sides"];
    if (supported.includes(category)) return category;
    if (category === "Proteins") return "Grills";
    if (category === "Snacks") return "Sides";
    return "Everyday"; // Pasta, noodles, and other catalogue categories.
  }
  const statusLabels = { received:"Awaiting confirmation", confirmed:"Confirmed", preparing:"Being prepared", out_for_delivery:"Out for delivery", delivered:"Delivered", cancelled:"Cancelled" };

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
    await loadSharedCatalogue();
    await loadPreorderRequests();
    await loadOrders();
    document.getElementById("catalogueSearch")?.addEventListener("input", renderSharedCatalogue);
    document.getElementById("catalogueCategory")?.addEventListener("change", renderSharedCatalogue);
    document.getElementById("refreshPreorders")?.addEventListener("click", loadPreorderRequests);
    window.setInterval(() => { loadPreorderRequests().catch(() => {}); }, 30000);
  } catch (error) {
    showNotice(error.message || "We couldn't load your restaurant workspace. Please refresh and try again.", true);
  }

  async function loadMenu() {
    const { data, error } = await supabase.from("menu_items")
      .select("id,slug,name,category,price,description,image_url,is_available,tag,menu_type")
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
    // Catalogue-backed everyday dishes are managed only in Daily Availability.
    const everydayItems = menuItems.filter(item => item.menu_type === "everyday" && !(item.slug || "").startsWith("catalog-"));
    const specialItems = menuItems.filter(item => item.menu_type !== "everyday");
    function addMenuSection(title, description, items) {
      const heading = safeElement("div", "menu-section-heading");
      heading.append(safeElement("h3", "", title), safeElement("p", "", description));
      menuList.append(heading);
      if (!items.length) {
        menuList.append(safeElement("p", "menu-section-empty", "No dishes in this section yet."));
        return;
      }
      items.forEach(item => {
      const card = safeElement("article", "managed-menu-card");
      const top = safeElement("div", "managed-menu-top");
      const copy = document.createElement("div");
      copy.append(safeElement("span", "menu-category-label", (item.menu_type === "everyday" ? "Everyday menu" : "Special menu") + " · " + item.category));
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
        document.getElementById("menuType").value = item.menu_type || "special";
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
      const remove = safeElement("button", "menu-delete-button", "Delete dish");
      remove.type = "button";
      remove.addEventListener("click", async () => {
        if (!window.confirm("Delete “" + item.name + "” from your menu? This cannot be undone.")) return;
        remove.disabled = true;
        try {
          if (item.slug && item.slug.startsWith("catalog-")) {
            const catalogDishId = Number(item.slug.split("-")[1]);
            if (Number.isInteger(catalogDishId) && catalogDishId > 0) {
              const { error: availabilityError } = await supabase.from("restaurant_dish_availability")
                .update({ is_available: false, updated_at: new Date().toISOString() })
                .eq("restaurant_id", restaurant.id).eq("dish_id", catalogDishId);
              if (availabilityError) throw availabilityError;
            }
          }
          const { error } = await supabase.from("menu_items").delete()
            .eq("id", item.id).eq("restaurant_id", restaurant.id);
          if (error) throw error;
          if (document.getElementById("menuItemId").value === String(item.id)) resetMenuForm();
          setMenuFeedback(item.name + " was removed from your available menu.");
          await loadMenu();
          await loadSharedCatalogue();
        } catch (error) {
          showNotice(error.message || "Could not delete this dish.", true);
          remove.disabled = false;
        }
      });
      buttons.append(edit, toggle, remove);
      actions.append(status, buttons);
      card.append(top, actions);
      menuList.append(card);
      });
    }
    addMenuSection("Everyday menu", "Your regular dishes customers can order whenever they are available.", everydayItems);
    addMenuSection("Special menu", "Extra dishes you add for selected days or occasions.", specialItems);
  }

  async function loadSharedCatalogue() {
    const [catalogueResult, availabilityResult] = await Promise.all([
      supabase.from("dish_catalog").select("id,name,category,description,image_url,sort_order").eq("is_active", true).order("sort_order").order("name"),
      supabase.from("restaurant_dish_availability").select("dish_id,price,is_available,menu_type").eq("restaurant_id", restaurant.id)
    ]);
    if (catalogueResult.error) throw catalogueResult.error;
    if (availabilityResult.error) throw availabilityResult.error;
    sharedDishes = catalogueResult.data || [];
    ownDishAvailability = availabilityResult.data || [];
    renderSharedCatalogue();
    renderDailyAvailability();
  }

  function renderSharedCatalogue() {
    const root = document.getElementById("sharedDishCatalogue");
    if (!root) return;
    const term = (document.getElementById("catalogueSearch")?.value || "").trim().toLowerCase();
    const category = document.getElementById("catalogueCategory")?.value || "All";
    // Once an everyday dish is saved, move it out of the shared picker.
    const filtered = sharedDishes.filter(dish => {
      const saved = ownDishAvailability.find(row => Number(row.dish_id) === Number(dish.id));
      const alreadySavedEveryday = saved && saved.menu_type === "everyday";
      return !alreadySavedEveryday
        && (category === "All" || dish.category === category)
        && (!term || (dish.name + " " + dish.category).toLowerCase().includes(term));
    });
    root.replaceChildren();
    if (!filtered.length) {
      root.append(safeElement("p", "empty-state", "No new dishes match that search. Your saved everyday dishes are in Daily Availability below."));
      return;
    }
    filtered.forEach(dish => {
      const saved = ownDishAvailability.find(row => Number(row.dish_id) === Number(dish.id));
      const row = safeElement("article", "shared-dish-row");
      const info = safeElement("div", "shared-dish-info");
      info.append(safeElement("strong", "", dish.name), safeElement("small", "", dish.category));
      if (dish.description) info.append(safeElement("p", "", dish.description));
      const controls = safeElement("div", "shared-dish-controls");
      const priceLabel = safeElement("label", "", "Your price (₦)");
      const price = document.createElement("input");
      price.type = "number"; price.min = "1"; price.max = "10000000"; price.step = "1";
      price.inputMode = "numeric"; price.value = saved?.price ? String(saved.price) : "";
      price.placeholder = "e.g. 2500"; price.setAttribute("aria-label", "Your price for " + dish.name);
      priceLabel.append(price);
      const availableLabel = safeElement("label", "catalogue-availability-toggle");
      const available = document.createElement("input");
      available.type = "checkbox"; available.checked = Boolean(saved?.is_available);
      availableLabel.append(available, safeElement("span", "", "Available today"));
      const menuType = document.createElement("select");
      menuType.setAttribute("aria-label", "Menu type for " + dish.name);
      [["everyday","Everyday"],["special","Special"]].forEach(([value,label]) => {
        const option = document.createElement("option"); option.value = value; option.textContent = label; option.selected = (saved?.menu_type || "everyday") === value; menuType.append(option);
      });
      const feedback = safeElement("small", "shared-dish-feedback", saved?.is_available ? "Visible to customers" : "Not listed as available");
      const save = safeElement("button", "btn", "Save dish");
      save.type = "button";
      save.addEventListener("click", async () => {
        const numericPrice = Number(price.value);
        if (!Number.isSafeInteger(numericPrice) || numericPrice < 1) {
          price.focus(); feedback.textContent = "Enter a valid price before saving this dish."; return;
        }
        save.disabled = true; available.disabled = true; menuType.disabled = true;
        feedback.textContent = "Saving…";
        try {
          const payload = { restaurant_id: restaurant.id, dish_id: dish.id, price: numericPrice, is_available: available.checked, menu_type: menuType.value, updated_at: new Date().toISOString() };
          const { error } = await supabase.from("restaurant_dish_availability").upsert(payload, { onConflict: "restaurant_id,dish_id" });
          if (error) throw error;
          const slug = "catalog-" + dish.id + "-" + restaurant.id;
          const menuPayload = { slug, name: dish.name, category: menuCategoryForDish(dish.category), price: numericPrice, description: dish.description || "", image_url: dish.image_url || "", restaurant_id: restaurant.id, menu_type: menuType.value, tag: menuType.value === "everyday" ? "Everyday favourite" : "Restaurant special", rating: 4.7, sort_order: Number(dish.sort_order || 0), is_available: available.checked };
          const { error: menuError } = await supabase.from("menu_items").upsert(menuPayload, { onConflict: "slug" });
          if (menuError) throw menuError;
          await loadSharedCatalogue();
          await loadMenu();
          showNotice(menuType.value === "everyday"
            ? dish.name + " was saved to Daily Availability. Use its button there to mark it available or finished."
            : dish.name + " was saved to your special menu.");
        } catch (error) {
          feedback.textContent = error.message || "Could not save this dish.";
        } finally {
          save.disabled = false; available.disabled = false; menuType.disabled = false;
        }
      });
      available.addEventListener("change", () => save.click());
      controls.append(priceLabel, menuType, availableLabel, save);
      row.append(info, controls, feedback);
      root.append(row);
    });
  }

  function renderDailyAvailability() {
    const root = document.getElementById("dailyAvailabilityList");
    if (!root) return;
    const dailyDishes = ownDishAvailability
      .filter(row => row.menu_type === "everyday")
      .map(row => ({ availability: row, dish: sharedDishes.find(item => Number(item.id) === Number(row.dish_id)) }))
      .filter(item => item.dish)
      .sort((a, b) => a.dish.name.localeCompare(b.dish.name));
    root.replaceChildren();
    if (!dailyDishes.length) {
      root.append(safeElement("p", "empty-state", "You haven't saved any everyday dishes yet. Choose a dish above and set its menu type to Everyday."));
      return;
    }
    dailyDishes.forEach(({ availability, dish }) => {
      const card = safeElement("article", "daily-availability-card" + (availability.is_available ? " is-available" : " is-finished"));
      const details = safeElement("div", "daily-availability-details");
      details.append(
        safeElement("strong", "", dish.name),
        safeElement("small", "", dish.category + " · " + money(availability.price)),
        safeElement("span", "daily-status", availability.is_available ? "Available today" : "Finished for today")
      );
      const toggle = safeElement("button", "btn " + (availability.is_available ? "btn-muted" : ""), availability.is_available ? "Mark finished" : "Mark available");
      toggle.type = "button";
      toggle.addEventListener("click", async () => {
        const nextAvailable = !availability.is_available;
        toggle.disabled = true;
        toggle.textContent = "Saving…";
        try {
          const { error } = await supabase.from("restaurant_dish_availability")
            .update({ is_available: nextAvailable, updated_at: new Date().toISOString() })
            .eq("restaurant_id", restaurant.id).eq("dish_id", dish.id);
          if (error) throw error;
          const slug = "catalog-" + dish.id + "-" + restaurant.id;
          // A dish can have availability saved without a menu_items row (for
          // example, if an earlier save only completed its first database write).
          // Upsert here repairs that gap as well as toggling existing menu items.
          const { error: menuError } = await supabase.from("menu_items").upsert({
            slug,
            name: dish.name,
            category: menuCategoryForDish(dish.category),
            price: Number(availability.price),
            description: dish.description || "",
            image_url: dish.image_url || "",
            restaurant_id: restaurant.id,
            menu_type: "everyday",
            tag: "Everyday favourite",
            rating: 4.7,
            sort_order: Number(dish.sort_order || 0),
            is_available: nextAvailable
          }, { onConflict: "slug" });
          if (menuError) throw menuError;
          await loadSharedCatalogue();
          await loadMenu();
          showNotice(dish.name + (nextAvailable ? " is now available to customers." : " is marked finished for today."));
        } catch (error) {
          showNotice(error.message || "Could not update today's availability.", true);
          toggle.disabled = false;
          toggle.textContent = availability.is_available ? "Mark finished" : "Mark available";
        }
      });
      card.append(details, toggle);
      root.append(card);
    });
  }

  async function loadPreorderRequests() {
    const root = document.getElementById("restaurantPreorders");
    if (!root || !restaurant || restaurant.status !== "approved") return;
    const refresh = document.getElementById("refreshPreorders");
    if (refresh) refresh.disabled = true;
    try {
      const { data, error } = await supabase.from("dish_preorder_requests")
        .select("id,dish_name,quantity,requested_for,notes,delivery_area,created_at")
        .eq("status", "pending").order("created_at", { ascending: true }).limit(100);
      if (error) throw error;
      const currentIds = new Set((data || []).map(request => request.id));
      if (knownPreorderIds) {
        const incoming = (data || []).filter(request => !knownPreorderIds.has(request.id));
        if (incoming.length) showNotice("New pre-order request" + (incoming.length > 1 ? "s" : "") + " received: " + incoming.map(request => request.dish_name).join(", ") + ". Review the pre-order inbox.");
      }
      knownPreorderIds = currentIds;
      root.replaceChildren();
      if (!data?.length) {
        root.append(safeElement("p", "empty-state", "No pending pre-order requests right now. New requests refresh automatically."));
        return;
      }
      data.forEach(request => {
        const card = safeElement("article", "restaurant-order-card preorder-request-card");
        const head = safeElement("div", "restaurant-order-head");
        head.append(safeElement("h3", "", request.dish_name), safeElement("span", "order-status-pill", "Open request"));
        card.append(head, safeElement("p", "order-meta", "Quantity: " + request.quantity + " · Requested " + new Date(request.created_at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })));
        if (request.requested_for) card.append(safeElement("p", "order-meta", "Needed by: " + new Date(request.requested_for).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })));
        if (request.delivery_area) card.append(safeElement("p", "order-meta", "Delivery area: " + request.delivery_area));
        if (request.notes) card.append(safeElement("p", "order-meta", "Customer note: " + request.notes));
        const accept = safeElement("button", "btn", "Accept this request");
        accept.type = "button";
        accept.addEventListener("click", async () => {
          accept.disabled = true;
          try {
            const { data: result, error: acceptError } = await supabase.rpc("accept_dish_preorder_request", { p_request_id: request.id });
            if (acceptError) throw acceptError;
            const outcome = Array.isArray(result) ? result[0] : result;
            if (!outcome?.accepted) {
              showNotice("Another restaurant has already accepted this request. It has been removed from the open list.", true);
            } else {
              showNotice("You accepted the pre-order request for " + request.dish_name + ".");
            }
            await loadPreorderRequests();
          } catch (error) {
            showNotice(error.message || "Could not accept this request.", true);
            accept.disabled = false;
          }
        });
        card.append(accept); root.append(card);
      });
    } catch (error) {
      root.replaceChildren(safeElement("p", "empty-state", error.message || "Could not load pre-order requests."));
    } finally {
      if (refresh) refresh.disabled = false;
    }
  }

  async function loadOrders() {
    ordersList.replaceChildren(safeElement("p", "loading-copy", "Loading incoming orders…"));
    const { data: orders, error } = await supabase.from("orders")
      .select("id,order_number,customer_name,customer_phone,delivery_address,delivery_area,delivery_notes,payment_method,subtotal,delivery_fee,total,status,created_at,requested_for")
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
    const availableOrders = orders.filter(order => { const orderLines = lines.filter(line => line.order_id === order.id); return orderLines.length > 0 && orderLines.every(line => menuItems.some(item => String(item.id) === String(line.menu_item_id))); });
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
      if (order.requested_for) card.append(safeElement("p", "order-meta", "Requested preparation / delivery time: " + new Date(order.requested_for).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })));
      else card.append(safeElement("p", "order-meta", "Requested time: As soon as the business can prepare it"));
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
      [["received","Awaiting confirmation"],["confirmed","Confirmed"],["preparing","Preparing"],["out_for_delivery","Out for delivery"],["delivered","Delivered"],["cancelled","Cancelled"]].forEach(([value,label]) => {
        const option = document.createElement("option"); option.value = value; option.textContent = label; option.selected = value === order.status; option.disabled = value === "received"; statusSelect.append(option);
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
    const menu_type = document.getElementById("menuType").value;
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
      const payload = { name, category, menu_type, price, description, image_url, restaurant_id: restaurant.id };
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