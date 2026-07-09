/**
 * Leitura e validação das variáveis de ambiente na fronteira da aplicação.
 * Só o que tem prefixo VITE_ é exposto ao cliente — nunca colocar segredos
 * de servidor aqui (service_role, chaves privadas).
 */

interface Env {
  supabaseUrl: string
  supabaseAnonKey: string
  /** true quando as credenciais do Supabase estão configuradas. */
  isSupabaseConfigured: boolean
}

function read(key: string): string {
  const value = import.meta.env[key]
  return typeof value === 'string' ? value.trim() : ''
}

const supabaseUrl = read('VITE_SUPABASE_URL')
const supabaseAnonKey = read('VITE_SUPABASE_ANON_KEY')

export const env: Env = {
  supabaseUrl,
  supabaseAnonKey,
  isSupabaseConfigured: supabaseUrl.length > 0 && supabaseAnonKey.length > 0,
}
