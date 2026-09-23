import { circleOpen } from '@/infrastructure/config/env'
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
  /** Só existe com o Círculo aberto (ver `circleOpen`). */
  readonly requiresCircle?: boolean
}

/**
 * A navegação do app em um lugar só. Sidebar, barra do celular e busca rápida
 * leem daqui — item novo aparece nos três sem edição em três arquivos.
 *
 * A ordem é o ciclo do produto, não o alfabeto: objetivo vira plano, plano vira
 * dia, dia vira progresso, progresso vira review, review vira objetivo de novo.
 * `Hoje` abre a lista porque é onde a pessoa entra todo dia.
 *
 * As descrições dizem o PAPEL de cada tela no ciclo, não a funcionalidade
 * dela. "Gráficos e estatísticas" descreve um recurso que qualquer app tem;
 * "se o ritmo está de pé e qual é o próximo ajuste" descreve o que essa tela
 * resolve — e é essa a diferença que o produto vende.
 */
const ALL_NAV: readonly AppNavItem[] = [
  {
    to: '/app',
    label: 'Hoje',
    end: true,
    icon: 'hoje',
    description: 'O que fazer agora, e o que muda quando o dia não sai como planejado',
  },
  {
    to: '/app/objetivos',
    label: 'Objetivos',
    end: false,
    icon: 'objetivo',
    description: 'Onde você quer chegar, com prazo e o quanto já andou de verdade',
  },
  {
    to: '/app/habitos',
    label: 'Hábitos',
    end: false,
    icon: 'habitos',
    description: 'A repetição que segura o plano quando a motivação cai',
  },
  {
    to: '/app/plano',
    label: 'Plano',
    end: false,
    icon: 'plano',
    description: 'O caminho até cada objetivo, e onde ele está travando',
  },
  {
    to: '/app/progresso',
    label: 'Progresso',
    end: false,
    icon: 'progresso',
    description: 'Se o teu ritmo está de pé, o que caiu e qual é o próximo ajuste',
  },
  {
    to: '/app/review',
    label: 'Review semanal',
    end: false,
    icon: 'calendario',
    description: 'O que a semana mostrou e o que muda na próxima',
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
    requiresCircle: true,
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
    requiresCircle: true,
  },

  /*
    Insights estava fora de TODA a navegação: a rota existia, a tela existia, e
    nenhuma parte do app levava até ela — nem a busca, que lê esta lista. É a
    tela que responde "o que mudou no meu ritmo", então ela entra aqui como
    secundária e ganha entrada direta no dashboard e no progresso, que são os
    dois lugares onde a pergunta nasce.
  */
  {
    to: '/app/insights',
    label: 'Leituras do ritmo',
    end: false,
    icon: 'insights',
    description: 'Os padrões que os teus registros mostram, com o ajuste de cada um',
    secondary: true,
  },

  /*
    A IA sai da navegação principal e vira ferramenta.

    Ela continua inteira e continua achável pela busca e pelos atalhos do
    perfil. O que muda é a promessa da barra lateral: um item "Momentumm AI"
    ao lado de "Hábitos" e "Progresso" apresenta o produto como uma coleção de
    recursos, e é justamente essa leitura que o posicionamento recusa. A IA não
    é um lugar onde se vai — é o que monta o plano no onboarding e o que lê o
    progresso quando a pessoa pede.
  */
  {
    to: '/app/ia',
    label: 'Momentumm AI',
    end: false,
    icon: 'ia',
    description: 'Transformar um objetivo em plano e ler o teu progresso',
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
    to: '/app/evolucao',
    label: 'Evolução',
    end: false,
    icon: 'subir',
    description: 'XP, nível, conquistas e o que o teu caminho já liberou',
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
  {
    to: '/app/assinatura',
    label: 'Assinatura',
    end: false,
    icon: 'raio',
    description: 'O PRO: assinar, ver a renovação ou cancelar',
    secondary: true,
  },
  {
    to: '/app/suporte',
    label: 'Suporte',
    end: false,
    icon: 'sino',
    description: 'Abrir um chamado e acompanhar a resposta',
    secondary: true,
  },
]

/** Tudo que a pessoa pode abrir hoje. Com o Círculo fechado, ele e os desafios somem daqui. */
export const APP_NAV: readonly AppNavItem[] = ALL_NAV.filter(
  (item) => circleOpen || !item.requiresCircle,
)

/** A navegação principal: só o ciclo do produto. */
export const PRIMARY_NAV = APP_NAV.filter((item) => !item.secondary)

export const SECONDARY_NAV = APP_NAV.filter((item) => item.secondary)

/**
 * O item de navegação que responde por uma rota. A mais específica ganha:
 * `/app/objetivos/123` é "Objetivos", não "Hoje". Os dois cabeçalhos (desktop e
 * celular) leem daqui pra dizer onde a pessoa está.
 */
export function navItemFor(pathname: string): AppNavItem | undefined {
  const matches = APP_NAV.filter((item) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to),
  )
  return matches.sort((a, b) => b.to.length - a.to.length)[0]
}
