/* Signup page: account type selection, business fields and password checks. */
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("signupForm");
  const businessFields = document.getElementById("restaurantFields");
  const accountTypeInputs = document.querySelectorAll('input[name="accountType"]');
  const password = document.getElementById("signupPassword");
  const confirmPassword = document.getElementById("confirmPassword");
  const passwordError = document.getElementById("passwordMatchError");
  const passwordToggle = document.getElementById("toggleSignupPassword");

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
  if (form) {
    form.addEventListener("reset", function () {
      window.setTimeout(updateAccountFields, 0);
    });
  }
  updateAccountFields();

  if (passwordToggle && password) {
    passwordToggle.addEventListener("click", function () {
      const showPassword = password.type === "password";
      password.type = showPassword ? "text" : "password";
      if (confirmPassword) confirmPassword.type = showPassword ? "text" : "password";
      passwordToggle.textContent = showPassword ? "Hide" : "Show";
      passwordToggle.setAttribute("aria-pressed", String(showPassword));
    });
  }

  if (form && password && confirmPassword) {
    form.addEventListener("submit", function (event) {
      if (password.value !== confirmPassword.value) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (passwordError) passwordError.textContent = "Your passwords do not match. Please try again.";
        confirmPassword.setAttribute("aria-invalid", "true");
        confirmPassword.focus();
        return;
      }
      if (passwordError) passwordError.textContent = "";
      confirmPassword.removeAttribute("aria-invalid");
    }, true);
  }
});
