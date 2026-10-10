/* CONTACT PAGE SCRIPT. Form remains demo-only until a backend is connected. */
document.addEventListener("DOMContentLoaded", function () {
  var form = document.querySelector("[data-demo-form]");
  if (!form) return;
  var email = form.querySelector('input[type="email"]');
  if (email) email.setAttribute("autocomplete", "email");
});
