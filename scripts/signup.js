import { supabase, supabaseConfigured } from "./supabase-client.js";

document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("signupForm");
  const businessFields = document.getElementById("restaurantFields");
  const accountTypeInputs = document.querySelectorAll('input[name="accountType"]');
  const password = document.getElementById("signupPassword");
  const confirmPassword = document.getElementById("confirmPassword");
  const passwordError = document.getElementById("passwordMatchError");
  const passwordToggle = document.getElementById("toggleSignupPassword");
  const formNote = form && form.querySelector("[data-form-note]");
  const submitButton = form && form.querySelector('button[type="submit"]');

  function showMessage(message, isError) {
    if (!formNote) return;
    formNote.textContent = message;
    formNote.classList.toggle("is-error", Boolean(isError));
    formNote.classList.toggle("is-success", !isError);
  }

  function updateAccountFields() {
    const selectedType = document.querySelector('input[name="accountType"]:checked');
    const isRestaurant = selectedType && selectedType.value === "restaurant";
    if (!businessFields) return;
    businessFields.hidden = !isRestaurant;
    businessFields.disabled = !isRestaurant;
    businessFields.querySelectorAll("input, select, textarea").forEach(function (field) {
      field.required = isRestaurant;
    });
  }

  accountTypeInputs.forEach(function (input) {
    input.addEventListener("change", updateAccountFields);
  });
  updateAccountFields();

  if (passwordToggle && password && confirmPassword) {
    passwordToggle.addEventListener("click", function () {
      const showPassword = password.type === "password";
      password.type = showPassword ? "text" : "password";
      confirmPassword.type = showPassword ? "text" : "password";
      passwordToggle.textContent = showPassword ? "Hide" : "Show";
      passwordToggle.setAttribute("aria-pressed", String(showPassword));
    });
  }

  if (!form) return;

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (password.value !== confirmPassword.value) {
      if (passwordError) passwordError.textContent = "Your passwords do not match. Please try again.";
      confirmPassword.setAttribute("aria-invalid", "true");
      confirmPassword.focus();
      return;
    }
    if (passwordError) passwordError.textContent = "";
    confirmPassword.removeAttribute("aria-invalid");

    if (!supabaseConfigured || !supabase) {
      showMessage("Supabase is not configured yet. Add your project's URL and publishable key in scripts/supabase-config.js before creating accounts.", true);
      return;
    }

    const selectedType = document.querySelector('input[name="accountType"]:checked');
    const accountType = selectedType ? selectedType.value : "customer";
    const metadata = {
      full_name: document.getElementById("fullName").value.trim(),
      phone: document.getElementById("phoneNumber").value.trim(),
      account_type: accountType,
    };

    if (accountType === "restaurant") {
      metadata.business_name = document.getElementById("businessName").value.trim();
      metadata.business_type = document.getElementById("businessType").value;
      metadata.business_address = document.getElementById("businessAddress").value.trim();
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
    }
    showMessage("Creating your account securely…", false);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: document.getElementById("signupEmail").value.trim(),
        password: password.value,
        options: {
          emailRedirectTo: new URL("login.html?confirmed=1", window.location.href).toString(),
          data: metadata,
        },
      });

      if (error) throw error;

      if (data.session) {
        showMessage(
          accountType === "restaurant"
            ? "Your account has been created. Your restaurant registration is pending review before restaurant features can be enabled."
            : "Your customer account has been created. You can now sign in.",
          false
        );
      } else {
        showMessage(
          "Registration received. Check your email for the confirmation link. " +
          (accountType === "restaurant" ? "Your restaurant will remain pending review until it is approved." : ""),
          false
        );
      }
      form.reset();
      updateAccountFields();
    } catch (error) {
      showMessage(error.message || "We could not create your account. Please try again.", true);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
      }
    }
  });
});
