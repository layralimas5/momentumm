import { PLAN_LIMITS } from '@/domain/entities/plan'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

const free = PLAN_LIMITS.free

/**
 * As dúvidas na ordem em que aparecem antes de alguém criar conta:
 * funcionamento, diferença, planos, IA, segurança, cancelamento.
 */
const QUESTIONS = [
  {
    question: 'Como o Momentumm funciona no dia a dia?',
    answer:
      'Você cria um objetivo com prazo, o app monta um plano por etapas e cada etapa vira ações com data. Todo dia você abre a tela Hoje, faz um check-in de dez segundos, cumpre a prioridade principal e marca os hábitos. No fim da semana, o review mostra onde evoluiu, onde o ritmo caiu e o que ajustar.',
  },
  {
    question: 'Quanto tempo por dia isso toma?',
    answer:
      'O check-in leva dez segundos e a prioridade do dia é uma só. O resto é o tempo que você já ia dedicar ao objetivo: o app organiza esse tempo, não cria mais. Em dia apertado, o Dia Adaptável encolhe o plano pro tempo que você tem.',
  },
  {
    question: 'Qual a diferença pra um app de hábitos, uma agenda ou o Notion?',
    answer:
      'Essas ferramentas registram o que você planejou. O Momentumm liga cada ação a um objetivo, mede quanto do objetivo já andou de verdade e percebe quando o plano parou de funcionar: dia adaptável quando a energia cai, modo retomada quando você some, e ajuste com botão pra aplicar. A pergunta que ele responde não é "fiz ou não fiz", é "estou avançando, e o que mudo se não estiver".',
  },
  {
    question: 'E se eu perder um dia? Perco tudo?',
    answer:
      'Não. A sequência conta dias cumpridos, e a versão mínima de um hábito conta. O Momentum Score olha 28 dias, então um dia vazio tira poucos pontos e nunca zera. Voltar em até dois dias devolve a nota cheia no fator de retomada.',
  },
  {
    question: 'O que tem no plano gratuito e o que muda no PRO?',
    answer: `O gratuito organiza e executa: até ${free.activeObjectives} objetivos ativos, ${free.activeHabits} hábitos, ${free.activePlans} plano por etapas, ${free.actionsPerDay} ações por dia, os últimos ${free.historyDays} dias de histórico, o Momentum Score de hoje e um check-in semanal manual. O PRO registra, analisa e evolui: tira os limites, abre o histórico completo, a evolução e o detalhamento do score, o review cruzando os dados reais, a Momentumm AI, métricas, relatórios, registros em texto, foto e voz, todos os modelos de compartilhamento e exportação. A tabela completa está na seção de planos.`,
  },
  {
    question: 'Como a IA usa os meus dados?',
    answer:
      'Ela lê o que você já colocou no app: objetivos, prazo, minutos por dia, hábitos, execução e Momentum. Com isso monta o plano, aponta gargalos e sugere ajustes. Toda sugestão vira uma prévia que você edita antes de salvar, e o que ela devolve segue as mesmas regras de domínio de um plano feito na mão. Nenhuma chave de IA roda no seu navegador.',
  },
  {
    question: 'Meus dados ficam privados?',
    answer:
      'Tudo nasce privado. A regra de quem vê o quê é aplicada no banco de dados (Row Level Security), não só na tela, então nem um erro de interface expõe o seu registro. Compartilhar um momento com o Círculo é uma escolha por item, e gerar uma imagem pro Stories não muda a visibilidade do dado. A conta tem verificação em duas etapas.',
  },
  {
    question: 'Posso cancelar quando quiser?',
    answer:
      'Sim. O PRO é uma assinatura sem fidelidade: cancela em Configurações e continua com o PRO até o fim do período pago. Depois disso a conta volta pro gratuito com tudo que você criou; o que passa do limite fica guardado, só não dá pra criar novos até liberar espaço.',
  },
] as const

export function Faq() {
  return (
    <Section id="faq" className="border-t border-line bg-surface/30">
      <SectionHeading eyebrow="Dúvidas" title="O que perguntam antes de começar" />

      <div className="mx-auto mt-12 flex max-w-2xl flex-col gap-3">
        {QUESTIONS.map((item, index) => (
          <Reveal key={item.question} delay={index * 0.03}>
            <details className="group rounded-card border border-line bg-surface transition-colors open:border-line-hi open:bg-surface-hi">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-medium text-ink marker:hidden">
                {item.question}
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-white transition-transform duration-200 group-open:rotate-180"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </span>
              </summary>
              <p className="px-5 pb-5 text-pretty text-sm text-ink-muted">{item.answer}</p>
            </details>
          </Reveal>
        ))}
      </div>

      <FaqJsonLd />
    </Section>
  )
}

/** Dados estruturados pra rich result de FAQ. Gerados da mesma lista da tela. */
function FaqJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: QUESTIONS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}
