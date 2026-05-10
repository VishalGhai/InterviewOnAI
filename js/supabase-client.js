/* Supabase Client — singleton instance for the app */

const SUPABASE_URL = 'https://wupvlyzvyzanvdroisbt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hPwKcSSakrNPEHq_nd-zqg_Hqc7Sz60';

// Use a distinct name to avoid shadowing the CDN's 'var supabase' global
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
