import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase credentials missing!");
} else {
  console.log("Supabase Client Initialized:", supabaseUrl);
  if (supabaseAnonKey.startsWith("sb_publishable_")) {
    console.warn("WARNING: VITE_SUPABASE_PUBLISHABLE_KEY looks like a Paystack key, not a Supabase key.");
    // Proactively alert the user as this is likely the cause of all issues
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        alert("CRITICAL ERROR: Your Supabase Key (in .env.local) starts with 'sb_publishable_'. This looks like a Paystack key, NOT a Supabase key. \n\nPlease replace it with your Supabase 'anon' key from the Supabase Dashboard.");
      }, 1000);
    }
  } else if (!supabaseAnonKey.startsWith("eyJ")) {
    console.warn("WARNING: Supabase Key does not look like a valid JWT. It should start with 'eyJ'.");
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
