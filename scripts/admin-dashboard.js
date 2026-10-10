import { supabase, supabaseConfigured } from "./supabase-client.js";

document.addEventListener("DOMContentLoaded", async () => {
  const notice = document.getElementById("adminNotice");
  const list = document.getElementById("applicationList");
  const filter = document.getElementById("statusFilter");
  const refreshButton = document.getElementById("refreshButton");
  const signOutButton = document.getElementById("signOutButton");
  let applications = [];
  let currentUser = null;

  const statusLabels = { pending: "Awaiting review", approved: "Approved", rejected: "Rejected" };
  const prettyDate = value => value ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Date not available";

  function showNotice(message, type = "") {
    notice.textContent = message;
    notice.hidden = !message;
    notice.className = "notice" + (type ? " is-" + type : "");
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function moneySafeText(value) { return value || "Not provided"; }

  if (!supabaseConfigured || !supabase) {
    showNotice("Administrator services are not configured. Please contact the site owner.", "error");
    list.replaceChildren(element("p", "empty-state", "The review workspace cannot connect to Supabase."));
    refreshButton.disabled = true;
    return;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    currentUser = data.session?.user || null;
    if (!currentUser) {
      window.location.replace("login.html?next=admin");
      return;
    }
    document.getElementById("adminIdentity").textContent = currentUser.email || "Signed in administrator";
    await loadApplications();
  } catch (error) {
    showNotice(error.message || "Could not verify administrator access.", "error");
    list.replaceChildren(element("p", "empty-state", "Access could not be verified. Refresh or sign in again."));
  }

  async function loadApplications() {
    refreshButton.disabled = true;
    list.replaceChildren(element("p", "loading-state", "Loading restaurant applications…"));
    try {
      const { data, error } = await supabase.rpc("admin_list_restaurants");
      if (error) {
        if (/administrator access required/i.test(error.message || "")) {
          showNotice("This signed-in account is not authorized to administer restaurant applications. Sign in with the designated administrator account.", "error");
        } else {
          showNotice(error.message || "Could not load restaurant applications.", "error");
        }
        list.replaceChildren(element("p", "empty-state", "No application data was shown because administrator access could not be confirmed."));
        return;
      }
      applications = Array.isArray(data) ? data : [];
      document.getElementById("pendingCount").textContent = applications.filter(item => item.status === "pending").length;
      document.getElementById("approvedCount").textContent = applications.filter(item => item.status === "approved").length;
      document.getElementById("rejectedCount").textContent = applications.filter(item => item.status === "rejected").length;
      document.getElementById("lastUpdated").textContent = "Updated " + new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
      showNotice("");
      renderApplications();
    } finally {
      refreshButton.disabled = false;
    }
  }

  function renderApplications() {
    const selected = filter.value;
    const visible = applications.filter(item => selected === "all" || item.status === selected);
    list.replaceChildren();
    if (!visible.length) {
      const empty = element("p", "empty-state");
      empty.append(element("strong", "", selected === "pending" ? "No applications awaiting review" : "Nothing to display"));
      empty.append(document.createTextNode(selected === "pending" ? "New restaurant registrations will appear here." : "There are no applications in this view."));
      list.append(empty);
      return;
    }

    visible.forEach(item => {
      const card = element("article", "application-card");
      const details = element("div", "application-details");
      details.append(element("h3", "", item.business_name || "Unnamed restaurant"));
      details.append(element("span", "application-status " + item.status, statusLabels[item.status] || item.status));
      details.append(element("p", "application-meta", (item.business_type || "Business type not provided") + " · Submitted " + prettyDate(item.created_at)));
      details.append(element("p", "application-meta", "Owner: " + (moneySafeText(item.owner_name)) + " · " + moneySafeText(item.owner_email)));
      details.append(element("p", "application-meta", "Phone: " + moneySafeText(item.owner_phone)));
      details.append(element("p", "application-address", "Business address: " + moneySafeText(item.business_address)));
      card.append(details);

      const actions = element("div", "application-actions");
      if (item.status === "pending") {
        const approve = element("button", "button button-approve", "Approve business");
        approve.type = "button";
        approve.addEventListener("click", () => reviewApplication(item, "approved", approve, actions));
        const reject = element("button", "button button-reject", "Reject application");
        reject.type = "button";
        reject.addEventListener("click", () => reviewApplication(item, "rejected", reject, actions));
        actions.append(approve, reject);
      } else {
        actions.append(element("span", "application-status " + item.status, statusLabels[item.status] || item.status));
      }
      card.append(actions);
      list.append(card);
    });
  }

  async function reviewApplication(item, decision, clickedButton, actionContainer) {
    const verb = decision === "approved" ? "approve" : "reject";
    if (!window.confirm("Are you sure you want to " + verb + " " + (item.business_name || "this restaurant") + "?")) return;
    const buttons = actionContainer.querySelectorAll("button");
    buttons.forEach(button => { button.disabled = true; });
    clickedButton.textContent = decision === "approved" ? "Approving…" : "Rejecting…";
    showNotice("");
    try {
      const { error } = await supabase.rpc("admin_review_restaurant", {
        p_restaurant_id: item.id,
        p_decision: decision
      });
      if (error) throw error;
      showNotice((item.business_name || "Restaurant application") + " has been " + decision + ".", "success");
      await loadApplications();
    } catch (error) {
      showNotice(error.message || "The review could not be saved. Refresh and try again.", "error");
      buttons.forEach(button => { button.disabled = false; });
      clickedButton.textContent = decision === "approved" ? "Approve business" : "Reject application";
    }
  }

  filter.addEventListener("change", renderApplications);
  refreshButton.addEventListener("click", async () => {
    try { await loadApplications(); }
    catch (error) { showNotice(error.message || "Refresh failed.", "error"); }
  });
  signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) {
      showNotice(error.message || "Could not sign out. Please try again.", "error");
      signOutButton.disabled = false;
      return;
    }
    window.location.replace("login.html?next=admin");
  });
});