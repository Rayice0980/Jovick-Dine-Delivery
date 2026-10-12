import { supabase, supabaseConfigured } from "./supabase-client.js";

async function refreshMenuAndAcceptedPreorders() {
  if (!supabaseConfigured || !supabase) return;
  try {
    const { data: menuData, error: menuError } = await supabase.rpc("get_public_available_menu");
    if (menuError) throw menuError;
    if (!Array.isArray(menuData)) throw new Error("The live menu response was invalid.");
    const menu = menuData.map((item) => ({
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

    const { data: requests, error: requestsError } = await supabase.rpc("get_my_preorder_bag");
    if (requestsError) throw requestsError;
    let cart = [];
    try {
      const saved = JSON.parse(localStorage.getItem("jovick-cart") || "[]");
      cart = Array.isArray(saved) ? saved : [];
    } catch {
      cart = [];
    }
    const orderedIds = new Set((requests || []).filter((request) => request.status === "ordered").map((request) => String(request.request_id)));
    const before = JSON.stringify(cart);
    cart = cart.filter((item) => !item.preorderRequestId || !orderedIds.has(String(item.preorderRequestId)));

    (requests || []).filter((request) => request.status === "accepted" && Number(request.accepted_price) > 0).forEach((request) => {
      const requestId = String(request.request_id);
      const privateItem = {
        id: "preorder:" + requestId,
        preorderRequestId: requestId,
        qty: Number(request.quantity),
        name: request.dish_name,
        price: Number(request.accepted_price),
        restaurantId: request.accepted_restaurant_id,
        restaurantName: request.restaurant_name || "Accepting business"
      };
      if (!Number.isInteger(privateItem.qty) || privateItem.qty < 1) return;
      const existing = cart.find((item) => String(item.preorderRequestId || "") === requestId);
      if (existing) Object.assign(existing, privateItem);
      else cart.push(privateItem);
    });

    if (JSON.stringify(cart) !== before) {
      localStorage.setItem("jovick-cart", JSON.stringify(cart));
      window.dispatchEvent(new CustomEvent("jovick:cart-updated", { detail: { source: "accepted-preorder" } }));
      if (typeof window.jovickSetMenu === "function") window.jovickSetMenu(menu);
    }
  } catch (error) {
    console.error("Menu or accepted pre-orders could not be refreshed.", error);
  }
}

window.addEventListener("load", refreshMenuAndAcceptedPreorders);
window.addEventListener("focus", refreshMenuAndAcceptedPreorders);
window.setInterval(() => {
  if (document.visibilityState === "visible") refreshMenuAndAcceptedPreorders();
}, 30000);
