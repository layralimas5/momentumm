/**
 * Atalho de desenvolvimento: abre o app já autenticado com a sessão demo, sem
 * passar pela tela de login. Serve pra trabalhar nas telas internas sem
 * autenticar a cada reload. Só vale em `vite dev` — num build de produção a
 * flag é ignorada, então não existe porta aberta em prod.
 */
export const isAuthBypass =
  import.meta.env.DEV && import.meta.env['VITE_AUTH_BYPASS']?.trim() === 'true'

/**
 * Sem Supabase configurado o app roda em MODO DEMO, com dados em memória.
 * Isso mantém o produto abrível por qualquer pessoa (e por mim, offline) sem
 * expor chave nenhuma no bundle.
 */
const url = import.meta.env['VITE_SUPABASE_URL']?.trim()
const anonKey = import.meta.env['VITE_SUPABASE_ANON_KEY']?.trim()

export const supabaseConfig =
  url && anonKey ? ({ url, anonKey } as const) : null

/**
 * O bypass força o modo demo mesmo com Supabase configurado: sem sessão real,
 * o RLS recusaria toda leitura e o app ficaria logado e vazio.
 */
export const isDemoMode = supabaseConfig === null || isAuthBypass
