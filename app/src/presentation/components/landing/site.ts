import { QUIZ_SHORT_PATH } from '@/domain/analytics/quiz-links'
import { TRIAL_DAYS } from '@/domain/billing/trial'

/**
 * Dados da landing que mudam sem mexer em componente: estágio do produto,
 * destinos dos CTAs, contato e redes. Quando o produto sair de "primeiras
 * vagas" pra lista de espera ou assinatura direta, é aqui que muda.
 */

export const SITE = {
  name: 'Momentumm',
  url: 'https://www.momentumm.com.br',
  tagline: 'Do objetivo à ação de hoje.',
  description:
    'O Momentumm transforma objetivos em ações diárias, mede se o ritmo está de pé e ajusta o plano quando ele deixa de funcionar. Um sistema de progresso pessoal, não mais um app de hábitos.',
  /**
   * Ainda não existe e-mail de contato. Quando existir, preencher aqui: o
   * rodapé e as páginas legais passam a mostrar sozinhos.
   */
  contactEmail: null as string | null,
} as const

/**
 * O estágio decide o CTA da página inteira. Hoje o produto aceita conta
 * gratuita direto, então o CTA principal cria conta.
 *
 * O secundário é o QUIZ, não mais o modo demo. Quem chega na página sem ter
 * ouvido falar do produto não quer passear por dados de outra pessoa: quer
 * saber se isso resolve o problema DELA. O quiz responde isso com um plano
 * feito com as respostas dela, e só pede conta depois — que é a ordem que o
 * funil dos carrosséis já usa. O modo demo continua em `/app`, pra quem
 * quiser olhar por dentro.
 */
export const CTA = {
  primary: { label: 'Começar grátis', to: '/entrar' },
  secondary: { label: 'Criar meu plano em 2 minutos', to: QUIZ_SHORT_PATH },
  badge: 'Acesso antecipado',
  reassurance: `Grátis, sem cartão, com ${TRIAL_DAYS} dias de PRO. O primeiro plano fica pronto em dois minutos.`,
} as const
