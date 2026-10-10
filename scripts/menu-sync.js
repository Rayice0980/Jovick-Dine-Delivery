import { supabase, supabaseConfigured } from "./supabase-client.js";

// Keep the existing static menu as a fallback if the network is unavailable.
window.addEventListener("load", async () => {
  if (!supabaseConfigured || !supabase) return;

  try {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, category, price, rating, tag, description, image_url, sort_order")
      .eq("is_available", true)
      .order("sort_order", { ascending: true });

    if (error) throw error;
    if (!Array.isArray(data) || data.length === 0) return;

    const menu = data.map((item) => ({
      id: Number(item.id),
      name: item.name,
      category: item.category,
      price: Number(item.price),
      rating: Number(item.rating).toFixed(1),
      tag: item.tag,
      desc: item.description,
      image: item.image_url,
    }));

    localStorage.setItem("jovick-menu-cache", JSON.stringify(menu));
    if (typeof window.jovickSetMenu === "function") {
      window.jovickSetMenu(menu);
    }
  } catch (error) {
    console.warn("Live menu could not be loaded; using the built-in sample menu.", error);
  }
});
