import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * A IA mostrada como conversa, não como lista de capacidades: três trocas em
 * que a pessoa dá pouco e recebe algo concreto. É uma demonstração escrita à
 * mão com o formato REAL das respostas (plano em etapas, leitura de progresso,
 * síntese da semana), sem prometer nada que o produto não devolva.
 */
const EXCHANGES = [
  {
    kind: 'Plano',
    you: 'Quero ler 6 livros até dezembro. Tenho 30 minutos por dia, de segunda a sexta.',
    ai: [
      'Plano em 3 etapas. Etapa 1, até 15/10: livros 1 e 2, 20 páginas por sessão.',
      'Primeira ação hoje: abrir o livro e ler a primeira sessão.',
      'Se o prazo apertar, a etapa 3 encolhe pra 1 livro. Você edita tudo antes de salvar.',
    ],
  },
  {
    kind: 'Progresso',
    you: null,
    ai: [
      'Você apareceu em 5 dos últimos 7 dias, mas a prioridade do dia ficou aberta em 3 deles.',
      'O gargalo é o horário: as sessões de noite não saem.',
      'Próxima ação: mover a leitura pra manhã de terça.',
    ],
  },
  {
    kind: 'Review',
    you: 'Semana difícil, entreguei menos.',
    ai: [
      'Execução de 60%, 4 dias ativos. Dois dias com versão mínima, que contam.',
      'Recomendação pra próxima semana: manter 20 páginas e cortar a ação extra de sábado.',
    ],
  },
] as const

export function MomentumAi() {
  return (
    <Section id="ia" className="border-t border-line bg-surface">
      <SectionHeading
        eyebrow="Momentumm AI"
        title="A IA que conhece o seu plano, não uma que responde qualquer coisa."
        description="Ela lê o que você já colocou no app e devolve plano, leitura de progresso e review. Toda sugestão vira uma prévia que você edita antes de salvar."
      />

      <Reveal>
        <div className="mx-auto mt-12 flex max-w-3xl flex-col gap-6 rounded-card border border-line bg-canvas p-4 sm:p-6">
          {EXCHANGES.map((exchange, index) => (
            <div key={exchange.kind} className="flex flex-col gap-3">
              <p className="text-center text-[11px] font-medium tracking-wide text-ink-faint uppercase">
                {exchange.kind}
              </p>

              {exchange.you ? (
                <Bubble side="you">{exchange.you}</Bubble>
              ) : (
                <p className="text-center text-xs text-ink-faint">
                  Sem pergunta: ela lê o progresso sozinha e avisa.
                </p>
              )}

              <Bubble side="ai" delay={index * 0.08}>
                {exchange.ai.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </Bubble>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.15}>
        <p className="mx-auto mt-8 max-w-2xl text-balance text-center text-sm text-ink-faint">
          A chave da IA fica no servidor. Nada roda no seu navegador, nenhum texto seu treina
          modelo, e a franquia mensal faz parte do PRO.
        </p>
      </Reveal>
    </Section>
  )
}

function Bubble({
  side,
  delay = 0,
  children,
}: {
  readonly side: 'you' | 'ai'
  readonly delay?: number
  readonly children: React.ReactNode
}) {
  const ai = side === 'ai'
  return (
    <Reveal delay={delay} className={cn('flex', ai ? 'justify-start' : 'justify-end')}>
      <div className={cn('flex max-w-[92%] gap-2.5 sm:max-w-[80%]', !ai && 'flex-row-reverse')}>
        <span
          className={cn(
            'mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
            ai ? 'bg-brand-dim text-brand-hi' : 'bg-surface-hi text-ink-muted',
          )}
          aria-hidden="true"
        >
          {ai ? <Icon name="ia" className="size-3.5" /> : 'V'}
        </span>
        <div>
          <p className={cn('text-[11px] text-ink-faint', !ai && 'text-right')}>{ai ? 'Momentumm AI' : 'Você'}</p>
          <div
            className={cn(
              'mt-1 space-y-1.5 rounded-2xl px-4 py-3 text-sm leading-relaxed',
              ai
                ? 'rounded-tl-md border border-brand/30 bg-brand-dim/30 text-ink'
                : 'rounded-tr-md bg-surface-hi text-ink',
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </Reveal>
  )
}
