import { useEffect, useRef, useState } from 'react'
import { animate, motion, useInView, useReducedMotion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * Os pesos e as regras vêm do domínio (`momentum.ts`): 35/30/20/15, janela de
 * 28 dias com a última semana valendo o triplo, impacto em vez de quantidade,
 * retomada medida pelo tempo até voltar. Se a calibragem mudar lá, muda aqui.
 */
const FACTORS = [
  {
    label: 'Consistência recente',
    weight: 35,
    description: 'Quantos dias você apareceu e o tamanho do que saiu em cada um.',
  },
  {
    label: 'Execução das prioridades',
    weight: 30,
    description: 'Se a ação que destrava a etapa foi feita, não se a lista foi riscada.',
  },
  {
    label: 'Progresso nos objetivos',
    weight: 20,
    description: 'O avanço real do plano. Fica neutro enquanto não existe plano montado.',
  },
  {
    label: 'Capacidade de retomada',
    weight: 15,
    description: 'Quanto tempo você leva pra voltar depois de uma pausa.',
  },
] as const

/** Duas regras bastam na landing: a janela e o custo de falhar. O resto mora no app. */
const RULES = [
  {
    title: 'Olha 28 dias, com a semana atual pesando o triplo',
    description:
      'Sete dias sozinhos viram termômetro de humor: uma gripe apaga um mês. Um mês sozinho não reage ao que você mudou hoje. Com o peso, a semana atual responde por metade do score.',
  },
  {
    title: 'Falhar um dia custa pouco e nunca zera',
    description:
      'Um dia vazio é um dia sem crédito, não um zero na conta. Com 28 dias na janela, o pior dia possível tira poucos pontos.',
  },
] as const

const LEVELS = ['Desacelerando', 'Retomando', 'Constante', 'Avançando'] as const

export function MomentumScore() {
  return (
    <Section id="momentum-score" className="border-t border-line">
      <SectionHeading
        eyebrow="Momentum Score"
        title="Um número que mede ritmo, não o seu valor."
        description="De 0 a 100, o Momentum diz se você está avançando, constante, retomando ou desacelerando. Ele compara você com você, e é desenhado pra uma falha isolada não apagar um mês de trabalho."
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
        <Reveal>
          <div className="surface-brand edge-light h-full rounded-card p-6 sm:p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-ink-faint">Momentum</p>
                <CountUp
                  value={72}
                  className="text-gradient-brand tabular mt-1 block text-6xl font-semibold leading-none tracking-tight sm:text-7xl"
                />
              </div>
              <div className="text-right">
                <span className="inline-flex rounded-full border border-brand/40 bg-brand-dim/40 px-2.5 py-1 text-xs font-medium text-brand-ink">
                  Constante
                </span>
                <p className="tabular mt-2 text-sm text-positive">+4 nesta semana</p>
              </div>
            </div>

            <ScoreWindow />

            <ul className="mt-8 space-y-4">
              {FACTORS.map((factor, index) => (
                <li key={factor.label}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-ink">{factor.label}</span>
                    <span className="tabular text-ink-faint">{factor.weight}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-top">
                    <motion.span
                      className="block h-full rounded-full bg-brand"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${factor.weight * 2.4}%` }}
                      viewport={{ once: true }}
                      transition={{
                        duration: 0.7,
                        delay: 0.1 + index * 0.08,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-ink-faint">{factor.description}</p>
                </li>
              ))}
            </ul>

            <p className="mt-6 text-xs text-ink-faint">
              Os pontos por fator somam exatamente o score. Um detalhamento que dá 47 embaixo de um
              46 ensina a desconfiar da conta.
            </p>
          </div>
        </Reveal>

        <div className="flex flex-col gap-4 lg:self-center">
          {RULES.map((rule, index) => (
            <Reveal key={rule.title} delay={index * 0.06}>
              <div className="pulse-on-hover rounded-card border border-line bg-surface p-5">
                <h3 className="font-medium text-ink">{rule.title}</h3>
                <p className="mt-2 text-pretty text-sm text-ink-muted">{rule.description}</p>
              </div>
            </Reveal>
          ))}

          <Reveal delay={0.2}>
            <div className="rounded-card border border-line bg-surface p-5">
              <p className="flex flex-wrap items-center gap-2 text-sm text-ink-faint">
                <span>Quatro classificações:</span>
                {LEVELS.map((level) => (
                  <span
                    key={level}
                    className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-muted"
                  >
                    {level}
                  </span>
                ))}
              </p>
              <p className="mt-3 text-pretty text-sm text-ink-faint">
                Abaixo de sete dias de história, o app diz que o número ainda está se formando, em
                vez de vender precisão que não existe.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}

/** O número sobe de zero até o valor quando entra na tela: ritmo se vê andando, não parado. */
function CountUp({ value, className }: { readonly value: number; readonly className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduced = useReducedMotion()
  const [current, setCurrent] = useState(reduced ? value : 0)

  useEffect(() => {
    if (!inView || reduced) return
    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setCurrent(Math.round(latest)),
    })
    return () => controls.stop()
  }, [inView, reduced, value])

  return (
    <span ref={ref} className={className}>
      {current}
    </span>
  )
}

/**
 * A janela de 28 dias como imagem: quatro semanas de dias, a atual maior e
 * em roxo (pesa o triplo), um dia vazio marcado pra mostrar que ele tira
 * pouco e não zera. É a regra das duas cards ao lado, sem precisar ler.
 */
const WINDOW_DAYS = 28
const EMPTY_DAY = 16
const WEAK_DAYS = new Set([3, 9, 22])

function ScoreWindow() {
  const reduced = useReducedMotion()
  const days = Array.from({ length: WINDOW_DAYS }, (_, index) => index)

  return (
    <div className="mt-7 rounded-2xl border border-line bg-canvas/60 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-ink">Últimos 28 dias</p>
        <p className="text-[11px] text-ink-faint">semana atual pesa 3×</p>
      </div>

      <ol className="mt-3 grid grid-cols-7 gap-1.5" aria-hidden="true">
        {days.map((day) => {
          const currentWeek = day >= WINDOW_DAYS - 7
          const empty = day === EMPTY_DAY
          const weak = WEAK_DAYS.has(day)
          return (
            <motion.li
              key={day}
              initial={reduced ? false : { opacity: 0, scale: 0.6 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.3, delay: 0.15 + day * 0.02, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'mx-auto rounded-full',
                currentWeek ? 'size-4 sm:size-5' : 'size-3 sm:size-3.5',
                empty && 'border border-dashed border-flame/80 bg-transparent',
                !empty && weak && 'bg-brand/35',
                !empty && !weak && (currentWeek ? 'bg-brand-hi' : 'bg-brand/70'),
              )}
            />
          )
        })}
      </ol>

      <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-faint">
        <div className="flex items-center gap-1.5">
          <dt className="size-2.5 rounded-full bg-brand-hi" />
          <dd>dia cheio</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="size-2.5 rounded-full bg-brand/35" />
          <dd>versão mínima</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="size-2.5 rounded-full border border-dashed border-flame/80" />
          <dd>
            dia vazio: <span className="text-flame">−2, não zero</span>
          </dd>
        </div>
      </dl>
    </div>
  )
}
