/**
 * Sem Supabase configurado o app roda em MODO DEMO, com dados em memória.
 * Isso mantém o produto abrível por qualquer pessoa (e por mim, offline) sem
 * expor chave nenhuma no bundle.
 */
const url = import.meta.env['VITE_SUPABASE_URL']?.trim()
const anonKey = import.meta.env['VITE_SUPABASE_ANON_KEY']?.trim()

export const supabaseConfig =
  url && anonKey ? ({ url, anonKey } as const) : null

export const isDemoMode = supabaseConfig === null
