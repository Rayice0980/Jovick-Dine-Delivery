/* SIGN-UP PAGE SCRIPT: visibility toggle and matching password check. */
document.addEventListener("DOMContentLoaded", function () {
  var form = document.querySelector("[data-demo-form]"),
    password = document.getElementById("signupPassword"),
    confirm = document.getElementById("confirmPassword"),
    error = document.getElementById("passwordMatchError"),
    toggle = document.getElementById("toggleSignupPassword");
  if (toggle && password)
    toggle.addEventListener("click", function () {
      var show = password.type === "password";
      password.type = show ? "text" : "password";
      if (confirm) confirm.type = show ? "text" : "password";
      toggle.textContent = show ? "Hide" : "Show";
    });
  if (form && password && confirm)
    form.addEventListener(
      "submit",
      function (event) {
        if (password.value !== confirm.value) {
          event.preventDefault();
          event.stopImmediatePropagation();
          if (error) error.textContent = "Your passwords do not match.";
          confirm.setAttribute("aria-invalid", "true");
          confirm.focus();
        } else {
          if (error) error.textContent = "";
          confirm.removeAttribute("aria-invalid");
        }
      },
      true,
    );
});
