import { supabase, supabaseConfigured } from "./supabase-client.js";

// This narrowly scoped database function returns public menu fields only.
// It checks restaurant approval server-side without exposing private restaurant records.
window.addEventListener("load", async () => {
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
    if (typeof window.jovickSetMenu === "function") {
      window.jovickSetMenu(menu);
    }

    // Accepted pre-orders become normal orderable menu items with the restaurant's agreed price.
    // Add each accepted request to this customer's bag only once.
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const user = sessionData.session?.user;
    if (user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("account_type").eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;
      if (profile?.account_type === "customer") {
        const { data: requests, error: requestsError } = await supabase
          .from("dish_preorder_requests")
          .select("id,accepted_menu_item_id,quantity")
          .eq("status", "accepted")
          .not("accepted_menu_item_id", "is", null);
        if (requestsError) throw requestsError;

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
          localStorage.setItem("jovick-accepted-preorder-ids", JSON.stringify(Array.from(processedSet)));
          if (typeof window.jovickSetMenu === "function") window.jovickSetMenu(menu);
        }
      }
    }
  } catch (error) {
    console.error("Live menu could not be loaded.", error);
    if (typeof window.jovickSetMenu === "function") window.jovickSetMenu([]);
  }
});
