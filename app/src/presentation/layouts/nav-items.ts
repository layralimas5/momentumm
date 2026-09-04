import type { IconName } from '@/presentation/components/ui/Icon'

export interface AppNavItem {
  readonly to: string
  readonly label: string
  readonly end: boolean
  readonly icon: IconName
  /** Mostrado na busca rápida pra a pessoa saber o que encontra em cada tela. */
  readonly description: string
}

/**
 * A navegação do app em um lugar só. Sidebar, barra do celular e busca rápida
 * leem daqui — item novo aparece nos três sem edição em três arquivos.
 */
export const APP_NAV: readonly AppNavItem[] = [
  {
    to: '/app',
    label: 'Hoje',
    end: true,
    icon: 'hoje',
    description: 'Check-in, prioridade do dia, hábitos e ritmo',
  },
  {
    to: '/app/jornada',
    label: 'Minha Jornada',
    end: false,
    icon: 'jornada',
    description: 'Tudo que você já registrou, dia a dia',
  },
  {
    to: '/app/habitos',
    label: 'Hábitos',
    end: false,
    icon: 'habitos',
    description: 'Seus hábitos, frequência e sequência',
  },
  {
    to: '/app/metas',
    label: 'Metas',
    end: false,
    icon: 'metas',
    description: 'Metas ativas e progresso por período',
  },
  {
    to: '/app/foco',
    label: 'Foco',
    end: false,
    icon: 'foco',
    description: 'Sessões de foco e minutos concentrados',
  },
  {
    to: '/app/review',
    label: 'Review',
    end: false,
    icon: 'calendario',
    description: 'Como foi a semana e o que muda na próxima',
  },
  {
    to: '/app/insights',
    label: 'Insights',
    end: false,
    icon: 'insights',
    description: 'O que os seus padrões estão mostrando',
  },
  {
    to: '/app/configuracoes',
    label: 'Configurações',
    end: false,
    icon: 'config',
    description: 'Perfil, visibilidade e plano',
  },
]
