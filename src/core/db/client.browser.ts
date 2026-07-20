import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { supabaseAnonKey, supabaseUrl } from './env';

/**
 * The Supabase client for client components.
 *
 * Anon key and RLS, same as the server client. Nothing reachable from a browser
 * ever holds a key that bypasses row level security.
 */
export function createBrowserSupabase() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}

export type BrowserSupabase = ReturnType<typeof createBrowserSupabase>;
