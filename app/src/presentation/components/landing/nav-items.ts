/** Estrutura do menu, espelhando a referência: 3 grupos + o PRO direto. */

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
    label: 'Recursos',
    links: [
      {
        label: 'Registro rápido',
        description: 'Dois toques entre fazer e registrar',
        href: '/#recursos',
      },
      { label: 'Sequência', description: 'Streak, recorde e o dia em risco', href: '/#eixos' },
      {
        label: 'Metas',
        description: 'Por dia, semana ou mês, somando sozinhas',
        href: '/#passo-metas',
      },
      { label: 'Histórico', description: 'Tudo agrupado por dia e por eixo', href: '/#resultados' },
    ],
  },
  {
    label: 'Soluções',
    links: [
      { label: 'Pra quem lê', description: 'Páginas, livros e ritmo de leitura', href: '/#passo-leituras' },
      { label: 'Pra quem estuda', description: 'Horas de estudo que viram evolução', href: '/#passo-metas' },
      { label: 'Pra quem treina', description: 'Treino na mesma linha do tempo', href: '/#passo-treinos' },
      {
        label: 'Pra quem acompanha alguém',
        description: 'Feed de quem você segue',
        href: '/#passo-comunidade',
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
