/* MENU PAGE SCRIPT: direct category links and visible dish count. */
document.addEventListener("DOMContentLoaded", function () {
  var params = new URLSearchParams(location.search),
    requested = params.get("category");
  if (requested) {
    var button = Array.from(document.querySelectorAll("[data-category]")).find(
      function (b) {
        return b.dataset.category.toLowerCase() === requested.toLowerCase();
      },
    );
    if (button) button.click();
  }
  var grid = document.getElementById("foodGrid"),
    search = document.getElementById("foodSearch"),
    status = document.getElementById("menuResults");
  function count() {
    if (!grid || !status) return;
    var n = grid.querySelectorAll(".food-card").length;
    status.textContent =
      n === 1 ? "Showing 1 dish" : "Showing " + n + " dishes";
  }
  if (grid && status) {
    new MutationObserver(count).observe(grid, {
      childList: true,
      subtree: true,
    });
    count();
  }
  if (search)
    search.setAttribute("aria-label", "Search dishes by name or description");
});
