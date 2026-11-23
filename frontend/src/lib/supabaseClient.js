const url = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
let validUrl = false;
try {
  const parsedUrl = new URL(url);
  validUrl = parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
} catch { validUrl = false; }

export const supabaseConfig = {
  hasUrl: Boolean(url),
  hasAnonKey: Boolean(anonKey),
  configured: Boolean(url && anonKey && validUrl),
  incomplete: Boolean(url) !== Boolean(anonKey),
  invalidUrl: Boolean(url && anonKey && !validUrl),
};

let clientPromise;

export function getSupabaseClient() {
  if (!supabaseConfig.configured) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }));
  }
  return clientPromise;
}
