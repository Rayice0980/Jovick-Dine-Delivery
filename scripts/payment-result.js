import { supabase, supabaseConfigured } from "./supabase-client.js";

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("paymentResult");
  const params = new URLSearchParams(window.location.search);
  const checkoutId = params.get("checkout_id") || "";
  const reference = params.get("reference") || params.get("trxref") || "";

  function render(titleText, messageText, success = false, orders = []) {
    container.replaceChildren();
    const title = document.createElement("h2");
    title.textContent = titleText;
    const message = document.createElement("p");
    message.textContent = messageText;
    container.append(title, message);
    if (orders.length) {
      const total = document.createElement("p");
      total.textContent = "Combined order total: ₦" + orders.reduce((sum, order) => sum + Number(order.total || 0), 0).toLocaleString("en-NG");
      container.append(total);
      const list = document.createElement("ul");
      orders.forEach(order => {
        const item = document.createElement("li");
        item.textContent = (order.restaurant_name || "Restaurant") + " — " + order.order_number + " — ₦" + Number(order.total || 0).toLocaleString("en-NG");
        list.append(item);
      });
      container.append(list);
    }
    const dashboard = document.createElement("a");
    dashboard.className = "btn";
    dashboard.href = "dashboard.html#orders";
    dashboard.textContent = success ? "View my orders" : "Go to My Orders";
    container.append(dashboard);
    if (!success) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "btn btn-outline";
      retry.textContent = "Check payment again";
      retry.addEventListener("click", () => verify());
      container.append(retry);
      const checkout = document.createElement("a");
      checkout.className = "btn btn-outline";
      checkout.href = "checkout.html";
      checkout.textContent = "Return to checkout";
      checkout.style.marginLeft = "8px";
      container.append(checkout);
    }
  }

  async function verify() {
    if (!supabaseConfigured || !supabase || !checkoutId) {
      render("We could not verify this checkout", "Open My Orders to check your account, or return to checkout and try again.");
      return;
    }
    render("Verifying your payment…", "Please wait. We will not mark the order paid based on the redirect alone.");
    try {
      const { data, error } = await supabase.functions.invoke("checkout-payments", {
        body: { action: "verify", checkout_id: checkoutId, reference }
      });
      if (error) throw error;
      if (!data?.success) {
        render("Payment is not confirmed yet", data?.message || "Do not pay again yet. Use Check payment again or review My Orders.", false);
        return;
      }
      localStorage.removeItem("jovick-cart");
      localStorage.removeItem("jovick-menu-cache");
      sessionStorage.removeItem("jovick-checkout-idempotency");
      render("Payment confirmed", "Your payment has been verified. Each restaurant has received its own order.", true, data.orders || []);
    } catch (error) {
      render("We could not confirm the payment yet", error.message || "Please check again shortly. Do not make another payment while this one is being checked.");
    }
  }

  await verify();
});
