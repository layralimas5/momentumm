import { SITE } from '@/presentation/components/landing/site'

/**
 * O que cada rota pública declara pra busca.
 *
 * ## O problema que isto resolve
 *
 * O app é uma SPA servida por um `index.html` só. Esse arquivo traz title,
 * description e `<link rel="canonical" href="https://www.momentumm.com.br/">`
 * fixos, e o Netlify devolve ele igualzinho pra TODA rota. Resultado: `/plano`,
 * `/ferramentas`, `/termos` e `/privacidade` estão no sitemap e, ao mesmo
 * tempo, dizem ao Google que a versão canônica delas é a home. Uma página que
 * aponta o canônico pra outra pede pra não ser indexada, então as quatro se
 * anulavam sozinhas.
 *
 * Pior: `/app` e `/admin` também herdavam `robots: index, follow`. O
 * `robots.txt` pede pra não rastrear, mas rastrear e indexar são coisas
 * diferentes, e um link externo pro app bastaria pra ele entrar no índice
 * como uma tela de login.
 *
 * ## Por que um mapa, e não metadata espalhada por página
 *
 * Metadata em cada componente vira quatro fontes de verdade pra mesma
 * pergunta, e a quinta página nasce sem nenhuma. Aqui a regra é uma só: rota
 * conhecida tem metadata própria, rota desconhecida é privada até prova em
 * contrário. Página nova que deva ser indexada precisa entrar nesta lista de
 * propósito, e é exatamente essa fricção que impede tela de conta de vazar
 * pro índice por esquecimento.
 */

export interface RouteSeo {
  readonly title: string
  readonly description: string
  /** O caminho canônico. Diferente do atual quando a rota é um apelido. */
  readonly canonicalPath: string
  readonly noindex: boolean
}

const ROBOTS_OPEN = 'index, follow, max-image-preview:large, max-snippet:-1'
const ROBOTS_CLOSED = 'noindex, nofollow'

export function robotsContent(seo: RouteSeo): string {
  return seo.noindex ? ROBOTS_CLOSED : ROBOTS_OPEN
}

export function canonicalUrl(seo: RouteSeo): string {
  return `${SITE.url}${seo.canonicalPath === '/' ? '/' : seo.canonicalPath}`
}

/**
 * As rotas que podem ser indexadas, e o que cada uma diz.
 *
 * Os títulos dizem o que a página resolve, não o nome dela. "Momentumm |
 * Ferramentas" descreve um item de menu; "Calculadoras de meta, prazo e ritmo"
 * descreve o que a pessoa vai encontrar, e é essa a frase que decide o clique
 * no resultado da busca.
 */
const PUBLIC: Readonly<Record<string, RouteSeo>> = {
  '/': {
    title: 'Momentumm: pare de recomeçar toda segunda-feira',
    description: SITE.description,
    canonicalPath: '/',
    noindex: false,
  },
  '/plano': {
    title: 'Crie seu plano: do objetivo até a primeira ação de hoje',
    description:
      'Responda onde quer chegar, o prazo e quanto tempo tem por dia. O Momentumm devolve um plano por etapas e a ação de hoje, antes de pedir conta.',
    canonicalPath: '/plano',
    noindex: false,
  },
  '/ferramentas': {
    title: 'Ferramentas grátis de meta, prazo e ritmo',
    description:
      'Calculadoras abertas, sem login: descubra se o prazo cabe no tempo que você tem e qual ritmo a sua meta exige por semana.',
    canonicalPath: '/ferramentas',
    noindex: false,
  },
  '/termos': {
    title: 'Termos de uso',
    description: 'As regras de uso do Momentumm, em português claro.',
    canonicalPath: '/termos',
    noindex: false,
  },
  '/privacidade': {
    title: 'Política de privacidade',
    description:
      'Quais dados o Momentumm guarda, por que guarda, e como você exporta ou apaga tudo quando quiser.',
    canonicalPath: '/privacidade',
    noindex: false,
  },
}

/**
 * Apelidos: mesma página, endereço diferente.
 *
 * `/criar-meu-plano` e `/plano` servem o mesmo quiz, e os links de campanha
 * (`/plano/<codigo>`) servem ele de novo com a origem marcada. Sem canônico,
 * seriam doze endereços disputando o mesmo conteúdo no índice, que é como uma
 * página boa vira várias páginas fracas.
 */
const ALIASES: Readonly<Record<string, string>> = {
  '/criar-meu-plano': '/plano',
}

/**
 * Rotas privadas ou pessoais, por prefixo.
 *
 * Convite por token não é "privado" no sentido de exigir senha, e é justamente
 * por isso que ele precisa estar aqui: é um endereço que pertence a UMA pessoa,
 * e indexá-lo publicaria o convite dela.
 */
const PRIVATE_PREFIXES: readonly string[] = [
  '/app',
  '/admin',
  '/entrar',
  '/nova-senha',
  '/juntos/',
  '/convite/',
  '/clube/',
  '/quiz/',
]

const FALLBACK: RouteSeo = {
  title: SITE.name,
  description: SITE.description,
  canonicalPath: '/',
  noindex: true,
}

/**
 * A metadata de um caminho.
 *
 * O padrão é `noindex`: rota que ninguém declarou aqui não entra no índice.
 * O contrário (indexar tudo e lembrar de bloquear) é a regra que já deixou
 * `/app` aberto pra busca.
 */
export function seoFor(pathname: string): RouteSeo {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const path = clean === '' ? '/' : clean

  const alias = ALIASES[path]
  if (alias) return PUBLIC[alias] ?? FALLBACK

  const exact = PUBLIC[path]
  if (exact) return exact

  // Link de campanha do quiz: conteúdo do /plano, com a origem na URL.
  if (path.startsWith('/plano/')) return PUBLIC['/plano'] ?? FALLBACK

  if (PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))) {
    return FALLBACK
  }

  return FALLBACK
}
