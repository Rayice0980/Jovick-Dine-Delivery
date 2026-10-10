import { supabase, supabaseConfigured } from "./supabase-client.js";

document.addEventListener("DOMContentLoaded", async () => {
  const message = document.getElementById("dashboardMessage");
  const profileForm = document.getElementById("profileForm");
  const saveButton = document.getElementById("saveProfileButton");
  const feedback = document.getElementById("profileFeedback");
  const signOutButton = document.getElementById("signOutButton");
  let currentUser = null;

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
