import { supabase, supabaseConfigured } from "./supabase-client.js";

document.addEventListener("click", async (event) => {
  const profileLink = event.target.closest("[data-profile-link]");
  const addButton = event.target.closest("[data-add]");
  if (!profileLink && !addButton) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (!supabaseConfigured || !supabase) {
    window.location.assign("login.html");
    return;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const user = data.session?.user;
    if (!user) {
      const next = profileLink ? "login.html" : "login.html?next=menu";
      window.location.assign(next);
      return;
    }

    if (profileLink) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .single();
      if (profileError) throw profileError;
      window.location.assign(profile.account_type === "restaurant" ? "restaurant-dashboard.html" : "dashboard.html");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    if (profile.account_type !== "customer") {
      window.location.assign(profile.account_type === "restaurant" ? "restaurant-dashboard.html" : "login.html");
      return;
    }
    if (addButton) window.jovickAddToCartAuthorized?.(Number(addButton.dataset.add));
  } catch (error) {
    console.error("Could not verify account access.", error);
    window.location.assign("login.html");
  }
}, true);
