/* Sign-in page: show or hide the password and explain account-type selection. */
document.addEventListener("DOMContentLoaded", function () {
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("togglePassword");
  const accountType = document.getElementById("accountType");
  const form = document.getElementById("loginForm");
  const formNote = form && form.querySelector("[data-form-note]");

  if (passwordInput && passwordToggle) {
    passwordToggle.addEventListener("click", function () {
      const showPassword = passwordInput.type === "password";
      passwordInput.type = showPassword ? "text" : "password";
      passwordToggle.textContent = showPassword ? "Hide" : "Show";
      passwordToggle.setAttribute("aria-pressed", String(showPassword));
    });
  }

  if (accountType && formNote) {
    accountType.addEventListener("change", function () {
      formNote.textContent = accountType.value === "restaurant"
        ? "Restaurant business sign-in preview. Real account verification is not connected yet."
        : "Customer sign-in preview. Real account verification is not connected yet.";
    });
  }
});
