/* Supabase Client — singleton instance for the app */

const SUPABASE_URL = 'https://wupvlyzvyzanvdroisbt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hPwKcSSakrNPEHq_nd-zqg_Hqc7Sz60';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
