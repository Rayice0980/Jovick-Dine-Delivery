/* FAQ PAGE SCRIPT: client-side question search. */
document.addEventListener("DOMContentLoaded", function () {
  var search = document.getElementById("faqSearch"),
    items = Array.from(document.querySelectorAll(".faq-item")),
    empty = document.getElementById("faqEmpty");
  if (!search) return;
  search.addEventListener("input", function () {
    var term = search.value.trim().toLowerCase(),
      visible = 0;
    items.forEach(function (item) {
      var match = item.textContent.toLowerCase().includes(term);
      item.hidden = !match;
      if (match) visible++;
    });
    if (empty) empty.hidden = visible !== 0;
  });
});
