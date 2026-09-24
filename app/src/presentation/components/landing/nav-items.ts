/**
 * Estrutura do menu: 2 grupos + os links diretos.
 *
 * As âncoras seguem os ids reais da LandingPage. Quando uma seção sair ou
 * mudar de id, é aqui que o link precisa acompanhar — link de menu apontando
 * pra âncora morta não dá erro, só não rola pra lugar nenhum.
 */

export interface NavLink {
  readonly label: string
  readonly description: string
  readonly href: string
}

export interface NavGroup {
  readonly label: string
  readonly links: readonly NavLink[]
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Ferramentas',
    links: [
      {
        label: 'Meta de leitura',
        description: 'Quantas páginas por dia pra terminar o livro',
        href: '/ferramentas#leitura',
      },
      {
        label: 'Meta de tempo',
        description: 'Minutos por dia pra bater sua meta do mês',
        href: '/ferramentas#tempo',
      },
      {
        label: 'Calendário de sequência',
        description: 'Quanto falta pra bater seu recorde',
        href: '/ferramentas#sequencia',
      },
    ],
  },
]

export const NAV_DIRECT: readonly NavLink[] = [
  { label: 'O app', description: 'O que muda no seu dia', href: '/#funcionalidades' },
  { label: 'Planos', description: 'Grátis e PRO, o que muda', href: '/#planos' },
  { label: 'Dúvidas', description: 'O que perguntam antes de começar', href: '/#faq' },
]
