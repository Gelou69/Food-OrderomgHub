// config/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "FATAL ERROR: Supabase environment variables are missing! " +
    "Please ensure you have a .env.local file in your project root " +
    "with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY defined."
  );
}

export const supabase = createClient(
  supabaseUrl || 'http://missing-url.com', 
  supabaseAnonKey || 'missing-key'
);