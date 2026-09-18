import { motion } from 'framer-motion'
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
  {
    title: 'Conta impacto, não quantidade',
    description:
      'A prioridade do dia vale 3, a ação de objetivo vale 2, a tarefa comum vale 1. Hábito tem teto: cinco marcações fáceis nunca passam a ação que destrava a etapa.',
  },
  {
    title: 'Voltar rápido devolve a nota',
    description:
      'Retomar em até dois dias devolve nota cheia no fator de retomada. A volta mais recente pesa o dobro das anteriores: a pergunta é "você consegue voltar?", e a resposta que vale é a de agora.',
  },
] as const

const LEVELS = ['Desacelerando', 'Retomando', 'Constante', 'Avançando'] as const

export function MomentumScore() {
  return (
    <Section id="momentum-score" className="border-t border-line">
      <SectionHeading
        eyebrow="Momentumm Score"
        title="Um número que mede ritmo, não o seu valor."
        description="De 0 a 100, o Momentumm diz se você está avançando, constante, retomando ou desacelerando. Ele compara você com você, e é desenhado pra uma falha isolada não apagar um mês de trabalho."
      />

      <div className="mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
        <Reveal>
          <div className="surface-brand edge-light h-full rounded-card p-6 sm:p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-ink-faint">Momentumm</p>
                <p className="text-gradient-brand tabular mt-1 text-6xl font-semibold leading-none tracking-tight sm:text-7xl">
                  72
                </p>
              </div>
              <div className="text-right">
                <span className="inline-flex rounded-full border border-brand/40 bg-brand-dim/40 px-2.5 py-1 text-xs font-medium text-brand-ink">
                  Constante
                </span>
                <p className="tabular mt-2 text-sm text-positive">+4 nesta semana</p>
              </div>
            </div>

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
                      transition={{ duration: 0.7, delay: 0.1 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-ink-faint">{factor.description}</p>
                </li>
              ))}
            </ul>

            <ScoreSparkline />

            <p className="mt-5 text-xs text-ink-faint">
              Os pontos por fator somam exatamente o score. Um detalhamento que dá 47 embaixo de
              um 46 ensina a desconfiar da conta.
            </p>
          </div>
        </Reveal>

        <div className="flex flex-col gap-4">
          {RULES.map((rule, index) => (
            <Reveal key={rule.title} delay={index * 0.06}>
              <div className="rounded-card border border-line bg-surface p-5">
                <h3 className="font-medium text-ink">{rule.title}</h3>
                <p className="mt-2 text-pretty text-sm text-ink-muted">{rule.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal delay={0.2}>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-sm text-ink-faint">
          <span>Quatro classificações:</span>
          {LEVELS.map((level) => (
            <span key={level} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-muted">
              {level}
            </span>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-center text-sm text-ink-faint">
          Abaixo de sete dias de história, o app diz que o número ainda está se formando, em vez
          de vender precisão que não existe.
        </p>
      </Reveal>
    </Section>
  )
}

/*
  Catorze dias, um deles perdido. É a prova visual da regra "falhar um dia
  custa pouco e nunca zera": a linha cai no dia 9 e está de volta no 11. SVG
  inline, sem biblioteca, porque são catorze pontos e uma marca.
*/
const SERIES = [61, 63, 64, 66, 67, 69, 70, 71, 64, 66, 70, 71, 72, 72] as const
const LOST_DAY = 8

function ScoreSparkline() {
  const width = 320
  const height = 88
  const pad = 8
  const min = 56
  const max = 76
  const x = (index: number) => pad + (index * (width - pad * 2)) / (SERIES.length - 1)
  const y = (value: number) => height - pad - ((value - min) * (height - pad * 2)) / (max - min)
  const path = SERIES.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(' ')
  const lost = SERIES[LOST_DAY] ?? min

  return (
    <figure className="mt-7">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-ink">Últimos 14 dias</span>
        <span className="text-ink-faint">um dia perdido, dois pra voltar</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Linha do score em 14 dias: cai no dia 9 e volta no dia 11" className="mt-2 h-auto w-full">
        <defs>
          <linearGradient id="score-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${path} L${x(SERIES.length - 1).toFixed(1)} ${height} L${x(0)} ${height} Z`} fill="url(#score-fill)" />
        <motion.path
          d={path}
          fill="none"
          stroke="var(--color-brand-hi)"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        />
        <circle cx={x(LOST_DAY)} cy={y(lost)} r="4" fill="var(--color-canvas)" stroke="var(--color-flame)" strokeWidth="2" />
        <circle cx={x(SERIES.length - 1)} cy={y(SERIES[SERIES.length - 1] ?? max)} r="3.5" fill="var(--color-brand-hi)" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] text-ink-faint">
        <span>
          <span className="inline-block size-2 rounded-full border-2 border-flame align-middle" /> dia 9: dia perdido
        </span>
        <span>dia 11: de volta a 70</span>
      </figcaption>
    </figure>
  )
}
