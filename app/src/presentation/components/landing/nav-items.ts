/**
 * Estrutura do menu: 3 grupos + o PRO direto.
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
        description: 'Registrar, acumular, continuar',
        href: '/#como-funciona',
      },
      {
        label: 'Testar agora',
        description: 'Registre uma atividade sem criar conta',
        href: '/#eixos',
      },
      {
        label: 'Sozinho ou com gente',
        description: 'O que funciona antes de ter ninguém no feed',
        href: '/#sozinho',
      },
      { label: 'Dúvidas', description: 'O que perguntam antes de começar', href: '/#faq' },
    ],
  },
  {
    label: 'Soluções',
    links: [
      { label: 'Pra quem lê', description: 'Páginas, livros e ritmo de leitura', href: '/#eixos' },
      { label: 'Pra quem estuda', description: 'Horas de estudo que viram evolução', href: '/#eixos' },
      { label: 'Pra quem treina', description: 'Treino na mesma linha do tempo', href: '/#eixos' },
      {
        label: 'Pra quem acompanha alguém',
        description: 'Feed de quem você segue',
        href: '/#sozinho',
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
  { label: 'Momentumm PRO', description: 'Planos e o que muda', href: '/#pro' },
]
