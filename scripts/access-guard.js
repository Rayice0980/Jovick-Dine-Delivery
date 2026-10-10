import { supabase, supabaseConfigured } from "./supabase-client.js";

function setSignOutVisibility(isSignedIn) {
  document.querySelectorAll("[data-signout-link]").forEach((link) => {
    link.hidden = !isSignedIn;
    link.style.display = isSignedIn ? "" : "none";
  });
}

async function syncSignOutVisibility() {
  if (!supabaseConfigured || !supabase) {
    setSignOutVisibility(false);
    return;
  }
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    setSignOutVisibility(Boolean(data.session?.user));
  } catch (error) {
    console.error("Could not check sign-in status for navigation.", error);
    setSignOutVisibility(false);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", syncSignOutVisibility, { once: true });
} else {
  syncSignOutVisibility();
}

supabase?.auth.onAuthStateChange((_event, session) => {
  setSignOutVisibility(Boolean(session?.user));
});

document.addEventListener("click", async (event) => {
  const profileLink = event.target.closest("[data-profile-link]");
  const addButton = event.target.closest("[data-add]");
  const signOutLink = event.target.closest("[data-signout-link]");
  if (!profileLink && !addButton && !signOutLink) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (!supabaseConfigured || !supabase) {
    window.location.assign("login.html");
    return;
  }

  try {
    if (signOutLink) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSignOutVisibility(false);
      window.location.replace("index.html");
      return;
    }

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
