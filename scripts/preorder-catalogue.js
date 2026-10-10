import { supabase, supabaseConfigured } from "./supabase-client.js";

document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("preorderDishCatalogue");
  const note = document.getElementById("preorderCatalogueNote");
  const search = document.getElementById("preorderDishSearch");
  const category = document.getElementById("preorderDishCategory");
  if (!root || !supabaseConfigured || !supabase) return;
  let dishes = [];
  let availableByDish = new Map();

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const money = value => "₦" + Number(value || 0).toLocaleString("en-NG");
  const showNote = (message, isError = false) => {
    note.textContent = message;
    note.classList.toggle("is-error", isError);
  };

  try {
    const [catalogueResult, availabilityResult] = await Promise.all([
      supabase.from("dish_catalog").select("id,name,category,description").eq("is_active", true).order("sort_order").order("name"),
      supabase.from("restaurant_dish_availability").select("dish_id,price,restaurant_id").eq("is_available", true)
    ]);
    if (catalogueResult.error) throw catalogueResult.error;
    if (availabilityResult.error) throw availabilityResult.error;
    dishes = catalogueResult.data || [];
    (availabilityResult.data || []).forEach(row => {
      const key = Number(row.dish_id);
      const current = availableByDish.get(key) || { count: 0, prices: [] };
      current.count += 1;
      current.prices.push(Number(row.price));
      availableByDish.set(key, current);
    });
    render();
  } catch (error) {
    root.replaceChildren(el("p", "form-note", error.message || "The full dish catalogue could not be loaded."));
  }

  search?.addEventListener("input", render);
  category?.addEventListener("change", render);

  function render() {
    const term = (search?.value || "").trim().toLowerCase();
    const selectedCategory = category?.value || "All";
    const visible = dishes.filter(dish =>
      (selectedCategory === "All" || dish.category === selectedCategory) &&
      (!term || (dish.name + " " + dish.category + " " + dish.description).toLowerCase().includes(term))
    );
    root.replaceChildren();
    if (!visible.length) {
      root.append(el("p", "form-note", "No dishes match your search."));
      return;
    }
    visible.forEach(dish => {
      const availability = availableByDish.get(Number(dish.id));
      const card = el("article", "preorder-dish-card");
      card.append(el("span", "preorder-dish-category", dish.category), el("h3", "", dish.name));
      if (dish.description) card.append(el("p", "preorder-dish-description", dish.description));
      if (availability?.count) {
        card.append(el("span", "catalogue-live-status", "Available now · " + availability.count + (availability.count === 1 ? " restaurant" : " restaurants")));
        card.append(el("p", "preorder-price-range", "From " + money(Math.min(...availability.prices))));
        card.append(el("a", "text-link", "Find it in the available menu ↑"));
        card.lastChild.href = "#foodGrid";
      } else {
        card.append(el("span", "catalogue-unavailable-status", "Not available today"));
        const button = el("button", "btn", "Request pre-order");
        button.type = "button";
        button.addEventListener("click", () => showRequestForm(card, dish, button));
        card.append(button);
      }
      root.append(card);
    });
  }

  function showRequestForm(card, dish, launchButton) {
    if (card.querySelector("form")) return;
    const form = document.createElement("form");
    form.className = "preorder-request-form";
    const quantityLabel = el("label", "", "Quantity");
    const quantity = document.createElement("input");
    quantity.type = "number"; quantity.min = "1"; quantity.max = "50"; quantity.step = "1"; quantity.value = "1"; quantity.required = true;
    quantityLabel.append(quantity);
    const areaLabel = el("label", "", "Delivery area");
    const area = document.createElement("input");
    area.maxLength = 160; area.placeholder = "e.g. Gwagwalada, Abuja"; area.required = true;
    areaLabel.append(area);
    const timeLabel = el("label", "", "When do you need it? (optional)");
    const requestedFor = document.createElement("input");
    requestedFor.type = "datetime-local";
    const min = new Date(Date.now() + 30 * 60 * 1000);
    requestedFor.min = new Date(min.getTime() - min.getTimezoneOffset() * 60000).toISOString().slice(0,16);
    timeLabel.append(requestedFor);
    const notesLabel = el("label", "", "Extra details (optional)");
    const notes = document.createElement("textarea");
    notes.rows = 2; notes.maxLength = 500; notes.placeholder = "Portion size, soup choice, or other details";
    notesLabel.append(notes);
    const submit = el("button", "btn", "Send request to restaurants");
    submit.type = "submit";
    const cancel = el("button", "btn btn-muted", "Cancel");
    cancel.type = "button"; cancel.addEventListener("click", () => form.remove());
    form.append(quantityLabel, areaLabel, timeLabel, notesLabel, submit, cancel);
    form.addEventListener("submit", async event => {
      event.preventDefault();
      submit.disabled = true;
      showNote("Sending your pre-order request…");
      try {
        const { data: sessionResult, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        const user = sessionResult.session?.user;
        if (!user) {
          window.location.href = "login.html?next=foods";
          return;
        }
        const { data: profile, error: profileError } = await supabase.from("profiles").select("account_type").eq("id", user.id).single();
        if (profileError) throw profileError;
        if (profile.account_type !== "customer") throw new Error("Please sign in with a customer account to request a pre-order.");
        const payload = {
          customer_id: user.id,
          dish_id: dish.id,
          dish_name: dish.name,
          quantity: Number(quantity.value),
          delivery_area: area.value.trim(),
          requested_for: requestedFor.value ? new Date(requestedFor.value).toISOString() : null,
          notes: notes.value.trim()
        };
        const { error } = await supabase.from("dish_preorder_requests").insert(payload);
        if (error) throw error;
        form.replaceChildren(el("strong", "catalogue-live-status", "Request sent to all approved restaurants."));
        showNote("Your request for " + dish.name + " has been sent. The first restaurant to accept it will handle the request.");
        launchButton.disabled = true;
        launchButton.textContent = "Request sent";
      } catch (error) {
        showNote(error.message || "Could not send the pre-order request.", true);
        submit.disabled = false;
      }
    });
    card.append(form);
  }
});
