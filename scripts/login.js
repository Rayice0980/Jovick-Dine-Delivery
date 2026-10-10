import { supabase, supabaseConfigured } from "./supabase-client.js";

document.addEventListener("DOMContentLoaded", function () {
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("togglePassword");
  const accountType = document.getElementById("accountType");
  const form = document.getElementById("loginForm");
  const formNote = form && form.querySelector("[data-form-note]");
  const submitButton = form && form.querySelector('button[type="submit"]');
  const signOutButton = document.getElementById("signOutButton");
  const resetButton = document.getElementById("forgotPasswordButton");
  const resetForm = document.getElementById("resetPasswordForm");
  const resetNote = document.getElementById("resetPasswordNote");
  const resetError = document.getElementById("resetPasswordError");
  const resetMode = new URLSearchParams(window.location.search).get("reset") === "1";

  function showMessage(message, isError) {
    if (!formNote) return;
    formNote.textContent = message;
    formNote.classList.toggle("is-error", Boolean(isError));
    formNote.classList.toggle("is-success", !isError);
  }

  function showResetMessage(message, isError) {
    if (!resetNote) return;
    resetNote.textContent = message;
    resetNote.classList.toggle("is-error", Boolean(isError));
    resetNote.classList.toggle("is-success", !isError);
  }

  if (passwordInput && passwordToggle) {
    passwordToggle.addEventListener("click", function () {
      const showPassword = passwordInput.type === "password";
      passwordInput.type = showPassword ? "text" : "password";
      passwordToggle.textContent = showPassword ? "Hide" : "Show";
      passwordToggle.setAttribute("aria-pressed", String(showPassword));
    });
  }

  if (resetMode && resetForm && form) {
    form.hidden = true;
    resetForm.hidden = false;
    showResetMessage("Choose a new password to finish resetting your account.", false);
  }

  if (new URLSearchParams(window.location.search).get("confirmed") === "1") {
    showMessage("Email confirmation complete. You can now sign in.", false);
  }

  if (!supabaseConfigured || !supabase) {
    showMessage("Supabase is not configured yet. Add your project's URL and publishable key in scripts/supabase-config.js to enable sign-in.", true);
  }

  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!supabaseConfigured || !supabase) {
        showMessage("Add your Supabase project URL and publishable key before signing in.", true);
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.setAttribute("aria-busy", "true");
      }
      showMessage("Signing you in securely…", false);

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: document.getElementById("email").value.trim(),
          password: passwordInput.value,
        });
        if (error) throw error;

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("account_type, full_name")
          .eq("id", data.user.id)
          .single();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          throw new Error("Your account profile is not ready. Please contact support before trying again.");
        }

        if (profile.account_type !== accountType.value) {
          await supabase.auth.signOut();
          throw new Error("This account is registered as a " +
            (profile.account_type === "restaurant" ? "restaurant business" : "customer") +
            " account. Choose the matching account type and try again.");
        }

        if (signOutButton) signOutButton.hidden = false;

        if (profile.account_type === "restaurant") {
          const { data: restaurant, error: restaurantError } = await supabase
            .from("restaurants")
            .select("status, name")
            .eq("owner_id", data.user.id)
            .maybeSingle();

          if (restaurantError) throw restaurantError;
          if (!restaurant || restaurant.status !== "approved") {
            showMessage("You are signed in, but your restaurant account is pending business review. Restaurant management access will be enabled after approval.", false);
          } else {
            showMessage("Welcome back, " + (profile.full_name || restaurant.name) + ". Your restaurant account is approved. Your dashboard is the next feature to build.", false);
          }
        } else {
          showMessage("Welcome back, " + (profile.full_name || "customer") + ". Opening your customer dashboard…", false);
          const nextPage = new URLSearchParams(window.location.search).get("next") === "checkout" ? "checkout.html" : "dashboard.html";
          window.location.replace(new URL(nextPage, window.location.href).toString());
        }
      } catch (error) {
        showMessage(error.message || "We could not sign you in. Please check your details and try again.", true);
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.removeAttribute("aria-busy");
        }
      }
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", async function () {
      if (!supabaseConfigured || !supabase) {
        showMessage("Configure Supabase before requesting a password reset.", true);
        return;
      }
      const email = document.getElementById("email").value.trim();
      if (!email) {
        showMessage("Enter your email address first, then choose Forgot password.", true);
        document.getElementById("email").focus();
        return;
      }
      resetButton.disabled = true;
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: new URL("login.html?reset=1", window.location.href).toString(),
        });
        if (error) throw error;
        showMessage("If an account exists for that email, a password reset link will be sent.", false);
      } catch (error) {
        showMessage(error.message || "We could not request a password reset. Please try again.", true);
      } finally {
        resetButton.disabled = false;
      }
    });
  }

  if (resetForm) {
    resetForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const newPassword = document.getElementById("newPassword");
      const confirmNewPassword = document.getElementById("confirmNewPassword");
      if (newPassword.value !== confirmNewPassword.value) {
        if (resetError) resetError.textContent = "Your passwords do not match. Please try again.";
        confirmNewPassword.focus();
        return;
      }
      if (!supabaseConfigured || !supabase) {
        showResetMessage("Supabase is not configured yet.", true);
        return;
      }

      const saveButton = resetForm.querySelector('button[type="submit"]');
      if (saveButton) saveButton.disabled = true;
      if (resetError) resetError.textContent = "";
      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword.value });
        if (error) throw error;
        showResetMessage("Your password has been updated. You can now sign in with your new password.", false);
        resetForm.reset();
        resetForm.hidden = true;
        if (form) form.hidden = false;
      } catch (error) {
        showResetMessage(error.message || "We could not update your password. Open the latest reset email and try again.", true);
      } finally {
        if (saveButton) saveButton.disabled = false;
      }
    });
  }

  if (signOutButton) {
    signOutButton.addEventListener("click", async function () {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut();
      if (error) {
        showMessage(error.message || "Sign-out failed. Please try again.", true);
        return;
      }
      signOutButton.hidden = true;
      showMessage("You have signed out.", false);
      form.reset();
    });
  }
});
