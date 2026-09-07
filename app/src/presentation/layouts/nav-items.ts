import type { IconName } from '@/presentation/components/ui/Icon'

export interface AppNavItem {
  readonly to: string
  readonly label: string
  readonly end: boolean
  readonly icon: IconName
  /** Mostrado na busca rápida pra a pessoa saber o que encontra em cada tela. */
  readonly description: string
  /** Fora da navegação principal: aparece só na busca e nos atalhos do perfil. */
  readonly secondary?: boolean
}

/**
 * A navegação do app em um lugar só. Sidebar, barra do celular e busca rápida
 * leem daqui — item novo aparece nos três sem edição em três arquivos.
 *
 * A ordem é o ciclo do produto, não o alfabeto: objetivo vira plano, plano vira
 * dia, dia vira progresso, progresso vira review, review vira objetivo de novo.
 * `Hoje` abre a lista porque é onde a pessoa entra todo dia.
 */
export const APP_NAV: readonly AppNavItem[] = [
  {
    to: '/app',
    label: 'Hoje',
    end: true,
    icon: 'hoje',
    description: 'O que fazer agora, o que é prioridade e quanto já avançou',
  },
  {
    to: '/app/objetivos',
    label: 'Objetivos',
    end: false,
    icon: 'objetivo',
    description: 'O que você quer conquistar, com prazo e progresso',
  },
  {
    to: '/app/habitos',
    label: 'Hábitos',
    end: false,
    icon: 'habitos',
    description: 'A repetição que sustenta, com frequência e consistência',
  },
  {
    to: '/app/plano',
    label: 'Plano',
    end: false,
    icon: 'plano',
    description: 'Os objetivos virando ações com data e ordem',
  },
  {
    to: '/app/progresso',
    label: 'Progresso',
    end: false,
    icon: 'progresso',
    description: 'Momentum, constância e o que precisa de atenção',
  },
  {
    to: '/app/review',
    label: 'Review semanal',
    end: false,
    icon: 'calendario',
    description: 'Como foi a semana e o que muda na próxima',
  },
  {
    to: '/app/ia',
    label: 'Momentumm AI',
    end: false,
    icon: 'ia',
    description: 'Transformar objetivo em plano e ler o teu progresso',
  },
  /*
    Círculo fecha a navegação principal, e não entra no meio do ciclo, porque
    ele não faz parte dele: o ciclo é objetivo → plano → dia → progresso →
    review. O Círculo é o que existe DEPOIS de o ciclo estar rodando, e vem
    por último de propósito — a pessoa abre o app pra cuidar da própria
    rotina, não pra ver a dos outros.
  */
  {
    to: '/app/circulo',
    label: 'Círculo',
    end: false,
    icon: 'jornada',
    description: 'Os amigos que você acompanha e o que eles compartilharam',
  },

  /*
    Desafio fica FORA da navegação principal, ao contrário do Círculo.

    Ele não é uma tela que se abre todo dia: o desafio acontece no dia comum,
    pelo hábito que a pessoa já cumpre, e a tela existe pra combinar, conferir
    e encerrar. Colocá-lo na barra principal criaria a expectativa de ter algo
    novo ali toda manhã — e a semana em que não tem nada ensinaria a ignorar.
  */
  {
    to: '/app/desafios',
    label: 'Desafios',
    end: false,
    icon: 'trofeu',
    description: 'Combinados curtos com o teu círculo, medidos pelo que você já faz',
    secondary: true,
  },

  // Fora da barra principal. Continuam existindo e continuam achaveis pela
  // busca — o que sai da navegação é o peso visual, não a funcionalidade.
  {
    to: '/app/foco',
    label: 'Foco',
    end: false,
    icon: 'foco',
    description: 'Sessões de foco e minutos concentrados',
    secondary: true,
  },
  {
    to: '/app/jornada',
    label: 'Minha Jornada',
    end: false,
    icon: 'jornada',
    description: 'Tudo que você já registrou, dia a dia',
    secondary: true,
  },
  {
    to: '/app/metas',
    label: 'Metas',
    end: false,
    icon: 'metas',
    description: 'Metas de ritmo por período',
    secondary: true,
  },
  {
    to: '/app/perfil',
    label: 'Perfil',
    end: false,
    icon: 'trofeu',
    description: 'Tua evolução: momentum, constância, objetivos e conquistas',
    secondary: true,
  },
  {
    to: '/app/configuracoes',
    label: 'Configurações',
    end: false,
    icon: 'config',
    description: 'Perfil, visibilidade e plano',
    secondary: true,
  },
]

/** A navegação principal: só o ciclo do produto. */
export const PRIMARY_NAV = APP_NAV.filter((item) => !item.secondary)

export const SECONDARY_NAV = APP_NAV.filter((item) => item.secondary)
