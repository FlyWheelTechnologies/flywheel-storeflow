import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase credentials missing!");
} else {
  console.log("Supabase Client Initialized:", supabaseUrl);
  if (supabaseAnonKey.startsWith("sb_publishable_")) {
    console.log("Using new Supabase Publishable Key format.");
  } else if (!supabaseAnonKey.startsWith("eyJ")) {
    console.warn("WARNING: Supabase Key does not look like a valid JWT. It should start with 'eyJ'.");
  }
}

const dummyUrl = "https://ongyutrabagetgdebdib.supabase.co"; // fallback matching the initialized domain
const dummyKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy";

export const supabase = createClient(
  supabaseUrl || dummyUrl,
  supabaseAnonKey || dummyKey
);
