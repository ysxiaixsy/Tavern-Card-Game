/**
 * Supabase client for online play. Configuration comes from EXPO_PUBLIC_*
 * env vars (.env at the repo root — see .env.example); the anon key is a
 * publishable key, all real authority lives behind RLS + the edge function.
 *
 * Auth: anonymous sign-in, persisted in AsyncStorage so the same identity
 * survives app restarts (that is what lets you reconnect to your games).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isOnlineConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isOnlineConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/** Sign in anonymously (once) and return the user id. */
export async function ensureSignedIn(): Promise<string> {
  if (!supabase) {
    throw new Error('Online play is not configured (missing EXPO_PUBLIC_SUPABASE_* env).');
  }
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    return sessionData.session.user.id;
  }
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(error?.message ?? 'Anonymous sign-in failed.');
  }
  return data.user.id;
}
