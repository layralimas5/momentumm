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
  /** Endereço de contato mostrado no rodapé e nas páginas legais. */
  contactEmail: 'contato@momentumm.app',
  social: [
    { label: 'Instagram', href: 'https://instagram.com/momentumm.app', icon: 'instagram' },
    { label: 'TikTok', href: 'https://tiktok.com/@momentumm.app', icon: 'tiktok' },
    { label: 'YouTube', href: 'https://youtube.com/@momentumm', icon: 'youtube' },
  ],
} as const

export type SocialIconName = (typeof SITE.social)[number]['icon']

/**
 * O estágio decide o CTA da página inteira. Hoje o produto aceita conta
 * gratuita direto, então o CTA principal cria conta e o secundário abre o
 * modo demo sem cadastro.
 */
export const CTA = {
  primary: { label: 'Começar grátis', to: '/entrar' },
  secondary: { label: 'Ver por dentro, sem criar conta', to: '/app' },
  badge: 'Primeiras vagas abertas',
  reassurance: 'Funciona no navegador. Sem cartão pra começar.',
} as const
