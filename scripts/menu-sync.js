import { supabase, supabaseConfigured } from "./supabase-client.js";

async function refreshMenuAndAcceptedPreorders() {
  if (!supabaseConfigured || !supabase) return;

  try {
    const { data, error } = await supabase.rpc("get_public_available_menu");
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("The live menu response was invalid.");

    const menu = data.map((item) => ({
      id: Number(item.id),
      name: item.name,
      category: item.category,
      price: Number(item.price),
      rating: Number(item.rating ?? 0).toFixed(1),
      tag: item.menu_type === "everyday" ? "Everyday favourite" : item.tag,
      desc: item.description,
      image: item.image_url,
    }));

    localStorage.setItem("jovick-menu-cache", JSON.stringify(menu));
    if (typeof window.jovickSetMenu === "function") window.jovickSetMenu(menu);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData.session?.user;
    if (!user) return;

    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("account_type").eq("id", user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.account_type !== "customer") return;

    // Only fetch this customer's requests; never mix accepted pre-orders across accounts.
    const { data: requests, error: requestsError } = await supabase
      .from("dish_preorder_requests")
      .select("id,customer_id,accepted_menu_item_id,quantity")
      .eq("customer_id", user.id)
      .eq("status", "accepted")
      .not("accepted_menu_item_id", "is", null);
    if (requestsError) throw requestsError;

    const userStorageKey = "jovick-accepted-preorder-ids:" + user.id;
    let processed = [];
    let cart = [];
    try {
      const userProcessed = JSON.parse(localStorage.getItem(userStorageKey) || "[]");
      const legacyProcessed = JSON.parse(localStorage.getItem("jovick-accepted-preorder-ids") || "[]");
      processed = [...new Set([...(Array.isArray(userProcessed) ? userProcessed : []), ...(Array.isArray(legacyProcessed) ? legacyProcessed : [])].map(String))];
      cart = JSON.parse(localStorage.getItem("jovick-cart") || "[]");
      if (!Array.isArray(cart)) cart = [];
    } catch {
      processed = [];
      cart = [];
    }

    const processedSet = new Set(processed);
    let changed = false;
    (requests || []).forEach((request) => {
      const requestId = String(request.id);
      const itemId = Number(request.accepted_menu_item_id);
      const quantity = Number(request.quantity);
      if (processedSet.has(requestId) || !menu.some((item) => item.id === itemId) || !Number.isInteger(quantity) || quantity < 1) return;
      const existing = cart.find((item) => Number(item.id) === itemId);
      if (existing) existing.qty = Number(existing.qty) + quantity;
      else cart.push({ id: itemId, qty: quantity });
      processedSet.add(requestId);
      changed = true;
    });

    if (changed) {
      localStorage.setItem("jovick-cart", JSON.stringify(cart));
      localStorage.setItem(userStorageKey, JSON.stringify(Array.from(processedSet)));
      localStorage.setItem("jovick-accepted-preorder-ids", JSON.stringify(Array.from(processedSet)));
      window.dispatchEvent(new CustomEvent("jovick:cart-updated", { detail: { source: "accepted-preorder" } }));
      if (typeof window.jovickSetMenu === "function") window.jovickSetMenu(menu);
    }
  } catch (error) {
    console.error("Menu or accepted pre-orders could not be refreshed.", error);
  }
}

window.addEventListener("load", refreshMenuAndAcceptedPreorders);
window.addEventListener("focus", refreshMenuAndAcceptedPreorders);
// Keep the bag in sync if a restaurant accepts a request while the customer is browsing.
window.setInterval(() => {
  if (document.visibilityState === "visible") refreshMenuAndAcceptedPreorders();
}, 30000);
