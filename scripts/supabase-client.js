import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const hasProjectUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(
  SUPABASE_URL,
);
const hasPublishableKey =
  SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_") ||
  (SUPABASE_PUBLISHABLE_KEY.startsWith("eyJ") &&
    SUPABASE_PUBLISHABLE_KEY.length > 100);

// Give each browser tab its own Supabase session namespace. sessionStorage survives
// navigation and refreshes in this tab, but is normally separate from other tabs.
function getTabSessionId() {
  const key = "jovick-dine-auth-tab-id";
  let id = window.sessionStorage.getItem(key);
  if (!id) {
    id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    window.sessionStorage.setItem(key, id);
  }
  return id;
}

export const supabaseConfigured = hasProjectUrl && hasPublishableKey;
export const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storage: window.sessionStorage,
        storageKey: "jovick-dine-auth-" + getTabSessionId(),
      },
    })
  : null;
