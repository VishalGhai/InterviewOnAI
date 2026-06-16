/* Supabase Client — singleton instance for the app */

const SUPABASE_URL = 'https://wupvlyzvyzanvdroisbt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_hPwKcSSakrNPEHq_nd-zqg_Hqc7Sz60';

// Use a distinct name to avoid shadowing the CDN's 'var supabase' global
let supabaseClient = null;

try {
	supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (error) {
	ErrorHandler.surface(error, {
		internalCode: 'SB-CLIENT-INIT-001',
		context: 'supabase-client.init'
	});
}
