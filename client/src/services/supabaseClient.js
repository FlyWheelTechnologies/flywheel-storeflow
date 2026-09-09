import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ongyutrabagetgdebdib.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

if (!supabaseAnonKey) {
  console.warn("⚠️ Supabase credentials missing! Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in environment variables.");
} else {
  console.log("⚡ Supabase Client Initialized for:", supabaseUrl);
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || "unconfigured-anon-key"
);
