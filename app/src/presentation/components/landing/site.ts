import { quizPathFor } from '@/domain/analytics/quiz-links'
import { TRIAL_DAYS } from '@/domain/billing/trial'

/**
 * Dados da landing que mudam sem mexer em componente: estágio do produto,
 * destinos dos CTAs, contato e redes. Quando o produto sair de "primeiras
 * vagas" pra lista de espera ou assinatura direta, é aqui que muda.
 */

export const SITE = {
  name: 'Momentumm',
  url: 'https://www.momentumm.com.br',
  tagline: 'Objetivo vira plano. Plano vira ação. Ação vira progresso.',
  description:
    'O Momentumm transforma sua meta em um plano possível, mostra o que realmente importa hoje e ajuda você a continuar quando a rotina sai do eixo.',
  /**
   * Ainda não existe e-mail de contato. Quando existir, preencher aqui: o
   * rodapé e as páginas legais passam a mostrar sozinhos.
   */
  contactEmail: null as string | null,
} as const

/**
 * Um CTA só na página inteira.
 *
 * "Criar meu plano" diz qual é a próxima ação, e a próxima ação é o QUIZ:
 * ele pergunta o objetivo, o prazo e o tempo disponível e devolve um plano
 * antes de pedir conta. Mandar esse botão pro formulário de cadastro seria
 * prometer plano e entregar campo de e-mail. Quem já tem conta vê "Abrir o
 * app" no lugar (`use-site-cta.ts`), e a porta de login fica no header.
 *
 * O secundário não é uma segunda oferta: é a saída pra quem ainda não
 * entendeu o produto e precisa rolar antes de decidir.
 */
export const CTA = {
  primary: { label: 'Criar meu plano', to: quizPathFor('lp-hero') },
  secondary: { label: 'Ver como funciona', to: '/#como-funciona' },
  reassurance: 'Grátis e sem cartão.',
} as const

/**
 * O teste de PRO só aparece na página quando esta chave estiver ligada.
 *
 * O fluxo existe em código (`trial.ts`), no banco (migration 0034, que dá os
 * dias também pra quem já tinha conta) e tem teste; o que esta chave protege
 * é a PROMESSA na página, que é uma afirmação sobre o produto rodando em
 * produção, não sobre o código. Desligar aqui tira a frase do hero, do preço,
 * do FAQ e do fechamento de uma vez só.
 *
 * Pra religar com segurança, conferir em produção, nesta ordem: conta nova
 * entra em PRO por {TRIAL_DAYS} dias; conta que já existia antes da 0034
 * também recebeu os dias; no fim do prazo a conta volta pro gratuito sem
 * apagar nada; nenhuma cobrança é disparada sem cartão.
 */
export const TRIAL_PROMISE_VERIFIED = true

/** A linha de garantia do fechamento, quando a promessa do teste está liberada. */
export const TRIAL_LINE = `${TRIAL_DAYS} dias de PRO · sem cartão · sem cobrança automática`
