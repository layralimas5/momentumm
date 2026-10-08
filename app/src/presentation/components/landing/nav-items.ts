/**
 * Estrutura do menu: 2 grupos + os links diretos.
 *
 * As âncoras seguem os ids reais da LandingPage. Quando uma seção sair ou
 * mudar de id, é aqui que o link precisa acompanhar, link de menu apontando
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
    label: 'O app',
    links: [
      { label: 'Por dentro', description: 'As três telas, da meta ao passo de hoje', href: '/#plataforma' },
      { label: 'Funcionalidades', description: 'O que já vem no gratuito', href: '/#funcionalidades' },
      { label: 'Recursos do PRO', description: 'O que vem além do básico', href: '/#recursos' },
      { label: 'Review semanal', description: 'A sua semana lida pra você', href: '/#diferencial' },
    ],
  },
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
  { label: 'Pra quem é', description: 'Se o Momentumm serve pra você', href: '/#pra-quem' },
  { label: 'Planos', description: 'Grátis e PRO, o que muda', href: '/#planos' },
  { label: 'Dúvidas', description: 'O que perguntam antes de começar', href: '/#faq' },
]
