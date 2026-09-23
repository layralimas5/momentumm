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
    label: 'Produto',
    links: [
      {
        label: 'Como funciona',
        description: 'Do objetivo ao próximo passo, em quatro momentos',
        href: '/#como-funciona',
      },
      {
        label: 'Quando a rotina muda',
        description: 'Dia adaptável e retomada, sem voltar ao zero',
        href: '/#retomada',
      },
      {
        label: 'A tela de hoje',
        description: 'O que importa agora, em uma tela',
        href: '/#hoje',
      },
      {
        label: 'Progresso',
        description: 'O número que mostra a sua constância',
        href: '/#progresso',
      },
      {
        label: 'Momentumm AI',
        description: 'Sugestões que conhecem a sua meta',
        href: '/#ia',
      },
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
  { label: 'Planos', description: 'Grátis e PRO, o que muda', href: '/#planos' },
  { label: 'Dúvidas', description: 'O que perguntam antes de começar', href: '/#faq' },
]
