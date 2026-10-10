import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";

const hasProjectUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL);
const hasPublishableKey = SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_") ||
  (SUPABASE_PUBLISHABLE_KEY.startsWith("eyJ") && SUPABASE_PUBLISHABLE_KEY.length > 100);

export const supabaseConfigured = hasProjectUrl && hasPublishableKey;
export const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;
