/**
 * Dados da landing que mudam sem mexer em componente: estágio do produto,
 * destinos dos CTAs, contato e redes. Quando o produto sair de "primeiras
 * vagas" pra lista de espera ou assinatura direta, é aqui que muda.
 */

export const SITE = {
  name: 'Momentumm',
  url: 'https://momentumm.app',
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
 * gratuita direto, então o CTA principal cria conta e o secundário abre o
 * modo demo sem cadastro.
 */
export const CTA = {
  primary: { label: 'Começar grátis', to: '/entrar' },
  secondary: { label: 'Ver por dentro, sem criar conta', to: '/app' },
  badge: 'Acesso antecipado',
  reassurance: 'Roda no navegador do celular e do computador. Sem cartão pra começar.',
} as const
