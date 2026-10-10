import { supabase, supabaseConfigured } from "./supabase-client.js";

// Only approved businesses' live menu items are shown; there is no sample-menu fallback.
window.addEventListener("load", async () => {
  if (!supabaseConfigured || !supabase) return;

  try {
    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name, category, price, rating, tag, description, image_url, sort_order, restaurants!inner(status)")
      .eq("is_available", true)
      .not("restaurant_id", "is", null)
      .eq("restaurants.status", "approved")
      .order("sort_order", { ascending: true });

    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("The live menu response was invalid.");

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
    console.error("Live menu could not be loaded.", error);
    if (typeof window.jovickSetMenu === "function") window.jovickSetMenu([]);
  }
});
