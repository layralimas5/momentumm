import { formatBRL, monthlyEquivalentCents, PRO_PRICES, type BillingCycle } from '@/domain/billing/billing-plans'
import { TRIAL_DAYS } from '@/domain/billing/trial'
import { PLAN_LIMITS } from '@/domain/entities/plan'

/**
 * Os planos da landing.
 *
 * Os LIMITES vêm do domínio (`PLAN_LIMITS`): quantos objetivos, hábitos,
 * planos, ações por dia e dias de histórico cada plano guarda. Copiar o número
 * aqui faria a landing prometer 5 hábitos no dia em que o app passasse a
 * guardar 3. O PREÇO também vem do domínio (`PRO_PRICES`): é o mesmo número
 * que a Edge Function manda pro checkout. O que mora neste arquivo é só o
 * que o domínio não sabe: texto e a frase de cada plano.
 *
 * A separação é uma frase: o gratuito ORGANIZA E EXECUTA, o PRO REGISTRA,
 * ANALISA E EVOLUI. Não existe tabela comparativa: o que cada plano inclui
 * está inteiro dentro do próprio card, pra ler no celular sem cruzar coluna.
 *
 * O PRO é um plano só com dois ciclos de cobrança. Dois cards pro mesmo
 * produto dividiam a atenção e escondiam o desconto do anual.
 */

export type { BillingCycle }

export interface Price {
  readonly amount: string
  readonly period: string
  readonly strike?: string
  readonly note?: string
  readonly savings?: string
}

export interface PricingPlan {
  readonly id: string
  readonly badge: string
  readonly headline: string
  readonly prices: Readonly<Record<BillingCycle, Price>>
  readonly description: string
  readonly features: readonly string[]
  readonly cta: string
  readonly highlight?: boolean
}

const free = PLAN_LIMITS.free
const pro = PRO_PRICES

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

const FREE_PRICE: Price = {
  amount: 'R$ 0',
  period: 'para sempre',
  savings: `${TRIAL_DAYS} dias de PRO inclusos`,
}

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    id: 'free',
    badge: 'FREE',
    headline: 'Organize e execute',
    prices: { mensal: FREE_PRICE, anual: FREE_PRICE },
    description: `Toda conta nova começa com ${TRIAL_DAYS} dias de PRO completo, sem cartão. Depois, o gratuito segue pra sempre: cria o objetivo, organiza os hábitos, acompanha as ações do dia e vê o teu Momentumm Score de hoje.`,
    features: [
      `${TRIAL_DAYS} dias com tudo do PRO ao criar a conta, sem cartão`,
      `Até ${plural(free.activeObjectives, 'objetivo ativo', 'objetivos ativos')}, ${plural(free.activeHabits, 'hábito ativo', 'hábitos ativos')} e ${plural(free.activePlans, 'plano por etapas', 'planos por etapas')}`,
      `Até ${free.actionsPerDay} ações por dia no Hoje`,
      `Histórico dos últimos ${free.historyDays} dias`,
      'Momentumm Score de hoje (só a pontuação atual)',
      'Check-in semanal manual',
      'Dia Adaptável e Modo Retomada',
      `${free.objectiveTemplates} modelos de objetivo`,
      'Compartilhamento: 3 arranjos, todas as cores, em PNG',
      '1 lembrete por hábito',
    ],
    cta: 'Começar grátis',
  },
  {
    id: 'pro',
    badge: 'PRO',
    headline: 'Registre, analise e evolua',
    prices: {
      mensal: {
        amount: formatBRL(pro.mensal.amountCents),
        period: '/mês',
        strike: formatBRL(pro.mensal.strikeCents),
      },
      anual: {
        amount: formatBRL(pro.anual.amountCents),
        period: '/ano',
        strike: formatBRL(pro.anual.strikeCents),
        note: `equivale a ${formatBRL(monthlyEquivalentCents('anual'))}/mês`,
        savings: `Economize ${formatBRL(pro.anual.strikeCents - pro.anual.amountCents)}`,
      },
    },
    description:
      'Entender os próprios padrões, registrar a jornada, ver as métricas e ajustar o plano com a leitura da IA. É a proposta inteira do Momentumm.',
    features: [
      'Objetivos, hábitos, planos e ações por dia ilimitados',
      'Histórico completo',
      'Momentumm Score com evolução e detalhamento',
      'Review semanal completo, cruzando os teus dados reais',
      `Momentumm AI: ${PLAN_LIMITS.pro.aiCallsPerMonth} leituras por mês`,
      'Análises de IA: padrões, gargalos e recomendações',
      'Métricas detalhadas e relatórios semanais e mensais',
      'Registros em texto, foto e voz',
      'Biblioteca completa de modelos de objetivo',
      'Compartilhamento com todos os modelos e personalização',
      'Exportação dos teus dados em PDF, imagem e CSV',
      'Lembretes personalizados, temas e preferências',
    ],
    cta: `Testar o PRO por ${TRIAL_DAYS} dias`,
    highlight: true,
  },
]

/** O que só o anual tem. Aparece no card do PRO quando o ciclo anual está selecionado. */
export const ANNUAL_EXTRAS = [
  'Preço protegido na renovação*',
  'Suporte prioritário',
  'Selo de fundador no perfil',
  'Acesso antecipado a novidades',
] as const

export const PRICING_FOOTNOTE =
  '* O preço protegido vale enquanto a assinatura anual não for cancelada. Os recursos do PRO entram conforme forem ficando prontos.'
