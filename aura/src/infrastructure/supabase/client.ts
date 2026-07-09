import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/infrastructure/config/env'
import type { Database } from '@/infrastructure/supabase/database.types'

/**
 * Client Supabase tipado (singleton). Retorna null quando as credenciais
 * ainda não foram configuradas — assim a app sobe e mostra um aviso claro
 * em vez de quebrar. Configure em `.env.local` (ver `.env.example`).
 */
export const supabase: SupabaseClient<Database> | null = env.isSupabaseConfigured
  ? createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

/** Garante um client configurado ou lança erro explicativo. */
export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error(
      'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local',
    )
  }
  return supabase
}
