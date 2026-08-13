import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseConfig } from '@/infrastructure/config/env'

let client: SupabaseClient | null = null

/** Só existe quando o app NÃO está em modo demo. */
export function supabase(): SupabaseClient {
  if (!supabaseConfig) {
    throw new Error('Supabase não configurado: o app deveria estar em modo demo.')
  }

  client ??= createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return client
}
