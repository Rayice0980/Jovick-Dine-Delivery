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
  } catch (error) {
    console.error("Live menu could not be loaded.", error);
    if (typeof window.jovickSetMenu === "function") window.jovickSetMenu([]);
  }
});
