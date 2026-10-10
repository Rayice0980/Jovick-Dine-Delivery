import { supabase, supabaseConfigured } from "./supabase-client.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("adminLoginForm");
  const emailInput = document.getElementById("adminEmail");
  const passwordInput = document.getElementById("adminPassword");
  const button = document.getElementById("adminLoginButton");
  const note = document.getElementById("adminLoginNote");

  function message(text, type = "") {
    note.textContent = text;
    note.hidden = !text;
    note.className = "admin-login-note" + (type ? " is-" + type : "");
  }

  if (!supabaseConfigured || !supabase) {
    message("Management sign-in is not configured. Please contact the site owner.", "error");
    button.disabled = true;
    return;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    button.disabled = true;
    button.textContent = "Verifying administrator…";
    message("Signing in and checking management permissions…");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailInput.value.trim(),
        password: passwordInput.value
      });
      if (signInError) throw signInError;

      // The server-side RPC verifies the signed-in user against the protected admin_users table.
      const { error: accessError } = await supabase.rpc("admin_list_restaurants");
      if (accessError) {
        await supabase.auth.signOut();
        if (/administrator access required/i.test(accessError.message || "")) {
          throw new Error("This account is not authorized for management. Use the administrator account, not a customer or restaurant-only account.");
        }
        throw accessError;
      }

      message("Administrator verified. Opening management…", "success");
      window.location.replace("admin-dashboard.html");
    } catch (error) {
      message(error.message || "Sign-in failed. Check your details and try again.", "error");
      button.disabled = false;
      button.textContent = "Sign in to management";
    }
  });
});