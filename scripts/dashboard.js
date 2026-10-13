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
        .select("id, order_id, item_name, quantity, line_total, menu_item_id, preorder_request_id, restaurant_id").in("order_id", orders.map((o) => o.id));
      if (linesError) throw linesError;
      const { data: ratings, error: ratingsError } = await supabase.from("menu_item_reviews")
        .select("order_item_id,rating,review_text,is_public").eq("customer_id", customerId).in("order_id", orders.map((o) => o.id));
      if (ratingsError) throw ratingsError;
      const ratingByLine = new Map((ratings || []).map(item => [String(item.order_item_id), item]));
      const { data: reports, error: reportsError } = await supabase.from("order_issue_reports")
        .select("id,order_id,reason,details,status,created_at")
        .eq("customer_id", customerId).in("order_id", orders.map((o) => o.id));
      if (reportsError) throw reportsError;
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
        footer.append(area, total); card.append(footer);
        const orderReports = (reports || []).filter((report) => Number(report.order_id) === Number(order.id));
        const reportArea = document.createElement("div"); reportArea.className = "order-report-area";
        if (orderReports.length) {
          orderReports.forEach((report) => {
            const reportLine = document.createElement("p"); reportLine.className = "order-report-status";
            const reasonLabels = { delivery_delayed: "Delivery delayed", marked_delivered_not_received: "Marked delivered, but not received", missing_items: "Missing items", wrong_order: "Wrong order", food_quality: "Food quality", other: "Other issue" };
            reportLine.textContent = "Report submitted · " + (reasonLabels[report.reason] || report.reason) + " · " + report.status;
            reportArea.append(reportLine);
          });
        } else if (order.status !== "cancelled") {
          const reportButton = document.createElement("button"); reportButton.type = "button"; reportButton.className = "btn btn-muted order-report-button"; reportButton.textContent = "Report a problem";
          reportButton.addEventListener("click", () => {
            reportButton.hidden = true;
            const reportForm = document.createElement("form"); reportForm.className = "order-report-form";
            const reasonLabel = document.createElement("label"); reasonLabel.textContent = "What happened?";
            const reason = document.createElement("select"); reason.required = true;
            [["delivery_delayed","Delivery is delayed"],["marked_delivered_not_received","Marked delivered, but food has not arrived"],["missing_items","Items are missing"],["wrong_order","Wrong order received"],["food_quality","Food quality problem"],["other","Other issue"]].forEach(([value,label]) => {
              const option = document.createElement("option"); option.value = value; option.textContent = label; reason.append(option);
            });
            reasonLabel.append(reason);
            const detailsLabel = document.createElement("label"); detailsLabel.textContent = "More details (optional)";
            const details = document.createElement("textarea"); details.rows = 3; details.maxLength = 1000; details.placeholder = "Tell us what happened";
            detailsLabel.append(details);
            const submit = document.createElement("button"); submit.type = "submit"; submit.className = "btn"; submit.textContent = "Submit report";
            const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "btn btn-muted"; cancel.textContent = "Cancel";
            cancel.addEventListener("click", () => { reportForm.remove(); reportButton.hidden = false; });
            reportForm.append(reasonLabel, detailsLabel, submit, cancel);
            reportForm.addEventListener("submit", async (event) => {
              event.preventDefault(); submit.disabled = true;
              try {
                const { error: reportError } = await supabase.from("order_issue_reports").insert({
                  order_id: order.id, customer_id: customerId, reason: reason.value, details: details.value.trim()
                });
                if (reportError) throw reportError;
                showMessage("Your report has been submitted for order " + order.order_number + ".", false);
                await loadOrders(customerId);
              } catch (error) {
                const errorText = document.createElement("p"); errorText.className = "order-report-error"; errorText.textContent = error.message || "Your report could not be submitted. Please try again.";
                reportForm.prepend(errorText); submit.disabled = false;
              }
            });
            reportArea.append(reportForm);
          });
          reportArea.append(reportButton);
        }
        if (order.status === "delivered") {
          const orderLines = (lines || []).filter((line) => Number(line.order_id) === Number(order.id));
          const reviewHeading = document.createElement("h4");
          reviewHeading.textContent = "Rate the food you received";
          reportArea.append(reviewHeading);
          orderLines.forEach((line) => {
            const savedReview = ratingByLine.get(String(line.id));
            const reviewBlock = document.createElement("div");
            reviewBlock.className = "order-item-review";
            const itemTitle = document.createElement("p");
            itemTitle.textContent = line.item_name + (line.preorder_request_id ? " · Private pre-order" : "");
            reviewBlock.append(itemTitle);
            if (savedReview) {
              const rated = document.createElement("p");
              rated.className = "order-rating-saved";
              rated.textContent = "Your rating: " + "★".repeat(Number(savedReview.rating)) + "☆".repeat(5 - Number(savedReview.rating)) + " (" + savedReview.rating + "/5)";
              reviewBlock.append(rated);
            } else {
              const ratingForm = document.createElement("form");
              ratingForm.className = "order-rating-form";
              const label = document.createElement("label");
              label.textContent = "How would you rate this food?";
              const select = document.createElement("select");
              select.required = true;
              select.setAttribute("aria-label", "Food rating");
              const placeholder = document.createElement("option");
              placeholder.value = "";
              placeholder.textContent = "Choose a rating";
              select.append(placeholder);
              [[5, "★★★★★ — Excellent"], [4, "★★★★☆ — Good"], [3, "★★★☆☆ — Average"], [2, "★★☆☆☆ — Poor"], [1, "★☆☆☆☆ — Very poor"]].forEach(([value, text]) => {
                const option = document.createElement("option");
                option.value = String(value);
                option.textContent = text;
                select.append(option);
              });
              label.append(select);
              const reviewLabel = document.createElement("label");
              reviewLabel.textContent = "Review (optional)";
              const reviewText = document.createElement("textarea");
              reviewText.maxLength = 1000;
              reviewText.rows = 2;
              reviewText.placeholder = "What did you think of this meal?";
              reviewLabel.append(reviewText);
              const submit = document.createElement("button");
              submit.type = "submit";
              submit.className = "btn";
              submit.textContent = "Confirm received & review food";
              const cancel = document.createElement("button");
              cancel.type = "button";
              cancel.className = "btn btn-muted";
              cancel.textContent = "Cancel";
              cancel.addEventListener("click", () => { ratingForm.remove(); reviewBlock.append(makeReviewButton(line)); });
              ratingForm.append(label, reviewLabel, submit, cancel);
              ratingForm.addEventListener("submit", async event => {
                event.preventDefault();
                submit.disabled = true;
                try {
                  const { error: ratingError } = await supabase.rpc("submit_menu_item_review", {
                    p_order_item_id: Number(line.id),
                    p_rating: Number(select.value),
                    p_review_text: reviewText.value.trim()
                  });
                  if (ratingError) throw ratingError;
                  showMessage("Receipt confirmed. Thank you for reviewing " + line.item_name + "!", false);
                  await loadOrders(customerId);
                } catch (error) {
                  const errorText = document.createElement("p");
                  errorText.className = "order-rating-error";
                  errorText.textContent = error.message || "Your review could not be saved. Please try again.";
                  ratingForm.prepend(errorText);
                  submit.disabled = false;
                }
              });
              reviewBlock.append(ratingForm);
            }
            reportArea.append(reviewBlock);
          });
        }
        card.append(reportArea); container.append(card);
      });
    } catch (error) {
      container.replaceChildren();
      const err = document.createElement("p"); err.className = "orders-list-empty is-error";
      err.textContent = error.message || "We couldn't load your orders. Please refresh."; container.append(err);
    }
  }

  async function syncAcceptedPreorders(customerId) {
    try {
      const { data: requests, error: requestError } = await supabase.rpc("get_my_preorder_bag");
      if (requestError) throw requestError;
      const allRequests = requests || [];
      let cart = [];
      try { const parsed = JSON.parse(localStorage.getItem("jovick-cart") || "[]"); cart = Array.isArray(parsed) ? parsed : []; } catch { cart = []; }
      const orderedIds = new Set(allRequests.filter((request) => request.status === "ordered").map((request) => String(request.request_id)));
      cart = cart.filter((item) => !item.preorderRequestId || !orderedIds.has(String(item.preorderRequestId)));
      allRequests.filter((request) => request.status === "accepted" && Number(request.accepted_price) > 0).forEach((request) => {
        const requestId = String(request.request_id);
        const privateItem = { id: "preorder:" + requestId, preorderRequestId: requestId, qty: Number(request.quantity), name: request.dish_name, price: Number(request.accepted_price), restaurantId: request.accepted_restaurant_id, restaurantName: request.restaurant_name || "Accepting business" };
        if (!Number.isInteger(privateItem.qty) || privateItem.qty < 1) return;
        const existing = cart.find((item) => String(item.preorderRequestId || "") === requestId);
        if (existing) Object.assign(existing, privateItem); else cart.push(privateItem);
      });
      localStorage.setItem("jovick-cart", JSON.stringify(cart));
      window.dispatchEvent(new CustomEvent("jovick:cart-updated", { detail: { source: "accepted-preorder" } }));

      let panel = document.getElementById("acceptedPreordersPanel");
      if (!panel) {
        panel = document.createElement("section"); panel.id = "acceptedPreordersPanel"; panel.className = "dashboard-panel";
        const ordersSection = document.getElementById("orders");
        if (ordersSection?.parentNode) ordersSection.parentNode.insertBefore(panel, ordersSection);
      }
      panel.replaceChildren();
      const heading = document.createElement("h2"); heading.textContent = "Accepted pre-orders"; panel.append(heading);
      const accepted = allRequests.filter((request) => request.status === "accepted");
      if (!accepted.length) {
        const empty = document.createElement("p"); empty.textContent = "Accepted pre-orders will appear here when a business agrees to prepare your requested dish."; panel.append(empty);
        return;
      }
      accepted.forEach((request) => {
        const card = document.createElement("article"); card.className = "order-history-card";
        const title = document.createElement("h3"); title.textContent = request.dish_name || "Accepted dish";
        const details = document.createElement("p"); details.textContent = "Quantity: " + request.quantity + " · Price per item: ₦" + Number(request.accepted_price).toLocaleString("en-NG");
        const business = document.createElement("p"); business.textContent = "Accepted by: " + (request.restaurant_name || "Business");
        const note = document.createElement("p"); note.textContent = "This dish is private to you and the accepting business; it is not listed on the public menu.";
        const link = document.createElement("a"); link.href = "checkout.html"; link.className = "btn"; link.textContent = "Review bag and check out";
        card.append(title, details, business, note, link); panel.append(card);
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
    window.setInterval(() => { if (document.visibilityState === "visible") syncAcceptedPreorders(currentUser.id).catch(() => {}); }, 30000);

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
