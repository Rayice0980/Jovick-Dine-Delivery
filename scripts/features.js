/* HOW-IT-WORKS PAGE SCRIPT: keyboard navigation for the steps. */
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll(".steps .step").forEach(function (step) {
    step.setAttribute("tabindex", "0");
  });
});
