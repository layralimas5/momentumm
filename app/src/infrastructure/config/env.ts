/**
 * Atalho de desenvolvimento: abre o app já autenticado com a sessão demo, sem
 * passar pela tela de login. Serve pra trabalhar nas telas internas sem
 * autenticar a cada reload. Só vale em `vite dev` — num build de produção a
 * flag é ignorada, então não existe porta aberta em prod.
 */
export const isAuthBypass =
  import.meta.env.DEV && import.meta.env['VITE_AUTH_BYPASS']?.trim() === 'true'

/**
 * Login automático de desenvolvimento, com a conta REAL do Supabase.
 *
 * Diferente do bypass (que é demo, sem servidor), aqui o app entra sozinho
 * com e-mail e senha do `.env.local` na primeira carga. Só vale em
 * `vite dev`: em build de produção as variáveis são ignoradas, então não
 * existe caminho pra isso vazar. A senha fica no `.env.local`, que nunca é
 * commitado.
 */
const devEmail = import.meta.env['VITE_DEV_LOGIN_EMAIL']?.trim()
const devPassword = import.meta.env['VITE_DEV_LOGIN_PASSWORD']?.trim()

export const devAutoLogin =
  import.meta.env.DEV && devEmail && devPassword
    ? ({ email: devEmail, password: devPassword } as const)
    : null

/**
 * O que está errado com o atalho de login, quando está.
 *
 * Isto existe porque a falha era MUDA: senha velha no `.env.local` derrubava a
 * entrada automática e o app abria na tela de criar conta, sem dizer por quê —
 * e o palpite mais natural ("quebrei alguma coisa no código") é justamente o
 * errado.
 *
 * Só olha o que dá pra saber daqui: campo em branco, senha curta demais pra ser
 * aceita pelo cadastro, e-mail sem arroba. O resto (senha trocada, conta que
 * não existe) só o servidor sabe, e quem conta é o `AuthProvider`.
 */
export function devAutoLoginProblem(): string | null {
  if (!import.meta.env.DEV) return null
  if (!devEmail && !devPassword) return null

  if (!devEmail) return 'Falta VITE_DEV_LOGIN_EMAIL no .env.local.'
  if (!devPassword) return 'Falta VITE_DEV_LOGIN_PASSWORD no .env.local.'
  if (!devEmail.includes('@')) return 'VITE_DEV_LOGIN_EMAIL não parece um e-mail.'

  // 12 é o mínimo que o cadastro aceita (`MIN_PASSWORD_LENGTH`): uma senha
  // menor que isso no arquivo é senha velha, de antes da regra — ela nunca vai
  // entrar, e o servidor só vai responder "credenciais inválidas".
  if (devPassword.length < 12) {
    return `A senha em VITE_DEV_LOGIN_PASSWORD tem ${devPassword.length} caracteres, e o mínimo da conta é 12. É provável que seja uma senha antiga.`
  }

  return null
}

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

/**
 * O Círculo (comunidade) fica fechado até o produto ter os primeiros dez
 * assinantes: uma rede social vazia ensina a pessoa a ignorar a aba. Abrir é
 * ligar `VITE_CIRCLE_OPEN=true` no Netlify e publicar de novo; no `.env.local`
 * serve pra trabalhar nas telas do Círculo em desenvolvimento.
 */
export const CIRCLE_LAUNCH_SUBSCRIBERS = 10

export const circleOpen = import.meta.env['VITE_CIRCLE_OPEN']?.trim() === 'true'

/**
 * Login com Google. O botão só aparece com `VITE_GOOGLE_LOGIN=true`, depois de
 * o provedor estar ligado no Supabase (Authentication > Providers > Google,
 * com client id e secret do Google Cloud). Sem isso o Supabase responde 400
 * ao botão e a pessoa cai numa página de erro.
 */
export const googleLoginEnabled = import.meta.env['VITE_GOOGLE_LOGIN']?.trim() === 'true'

/**
 * Chave pública VAPID do Web Push. É par da privada que fica na Edge
 * Function `push-reminders`; sem ela o app não oferece o lembrete. Nasce
 * com `npx web-push generate-vapid-keys`, uma vez.
 */
export const vapidPublicKey = import.meta.env['VITE_VAPID_PUBLIC_KEY']?.trim() || null
