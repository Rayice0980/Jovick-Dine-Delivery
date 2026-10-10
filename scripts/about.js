/* ABOUT PAGE SCRIPT: keyboard accessibility for feature cards. */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".feature-card").forEach(function (card) {
    card.setAttribute("tabindex", "0");
  });
});
