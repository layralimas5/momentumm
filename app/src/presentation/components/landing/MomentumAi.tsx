import { motion, useReducedMotion } from 'framer-motion'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { MockCard, MockLabel, MockRow, MockTag } from './PhoneMockup'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'

/**
 * As três funções que existem no contrato `AiService`: montar o plano, ler o
 * progresso e sintetizar o review. A seção descreve o que a IA recebe e o que
 * devolve, porque é a estrutura (etapas, ações, ajustes) que faz a sugestão
 * virar prévia editável em vez de texto solto.
 */
const CAPABILITIES: readonly {
  readonly icon: IconName
  readonly title: string
  readonly input: string
  readonly output: string
}[] = [
  {
    icon: 'plano',
    title: 'Monta o plano a partir do objetivo',
    input: 'o que você quer, até quando e quantos minutos por dia tem de verdade.',
    output:
      'etapas em ordem, hábito de apoio e as primeiras ações com data. Se o prazo não fecha, sugere outro e diz por quê.',
  },
  {
    icon: 'progresso',
    title: 'Lê o progresso e aponta o gargalo',
    input:
      'momentum, dias ativos, taxa de hábitos e ações, objetivos parados e a sua capacidade de hoje.',
    output: 'o gargalo, o sinal de sobrecarga e uma próxima ação concreta.',
  },
  {
    icon: 'calendario',
    title: 'Sintetiza a semana no review',
    input: 'execução, dias ativos e o que você escreveu sobre a semana.',
    output: 'um parágrafo sobre a semana e a recomendação que vira prioridade da próxima.',
  },
]

const EASE = [0.22, 1, 0.36, 1] as const

/** Cada bloco da prévia entra em sequência, como se estivesse sendo gerado. */
const BLOCK = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
}

export function MomentumAi() {
  const reduced = useReducedMotion()

  return (
    <Section id="ia" className="border-t border-line bg-surface-hi">
      <SectionHeading
        eyebrow="Momentumm AI"
        title="A IA que conhece o seu plano, não uma que responde qualquer coisa."
        description="Ela usa os seus objetivos, a sua rotina e o seu progresso pra planejar, interpretar resultados e sugerir ajustes. E devolve estrutura, não texto: cada sugestão vira uma prévia que você edita antes de salvar."
      />

      <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1fr_0.9fr] lg:gap-14">
        <ol className="flex flex-col gap-3">
          {CAPABILITIES.map((capability, index) => (
            <Reveal key={capability.title} delay={index * 0.06}>
              <li className="pulse-on-hover flex gap-4 rounded-card border border-line bg-surface p-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-dim text-brand-hi">
                  <Icon name={capability.icon} className="size-4.5" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-medium text-ink">{capability.title}</h3>
                  <p className="mt-1.5 text-pretty text-sm text-ink-muted">
                    <span className="text-ink-faint">Lê</span> {capability.input}{' '}
                    <span className="text-ink-faint">Devolve</span> {capability.output}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.12}>
          <motion.div
            aria-hidden="true"
            initial={reduced ? false : 'hidden'}
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            transition={{ staggerChildren: 0.28, delayChildren: 0.2 }}
            className="surface-brand edge-light mx-auto w-full max-w-md rounded-card p-5 sm:p-6 lg:max-w-none"
          >
            {/* O pedido, do jeito que a pessoa escreve. */}
            <motion.div variants={BLOCK} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5 text-sm text-white">
                Quero terminar o TCC até 30 de novembro. Tenho uns 45 min por dia, 5 dias na semana.
              </p>
            </motion.div>

            <motion.div variants={BLOCK} className="mt-4 flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-lg bg-brand-dim text-brand-hi">
                <Icon name="ia" className="size-3.5" />
              </span>
              <p className="text-xs font-medium uppercase tracking-wide text-brand-hi">
                Prévia do plano
              </p>
              <span className="ml-auto text-[11px] text-ink-faint">lendo os seus dados</span>
            </motion.div>

            <motion.div variants={BLOCK}>
              <p className="mt-3 text-sm font-medium text-ink">Terminar o TCC</p>
              <p className="text-xs text-ink-faint">
                Até 30 de novembro · 45 min por dia · 5 dias por semana
              </p>
            </motion.div>

            <motion.div variants={BLOCK}>
              <MockLabel>Etapas</MockLabel>
              <ol className="space-y-1.5">
                {[
                  'Entrar no ritmo',
                  'Revisão bibliográfica',
                  'Rascunho',
                  'Revisão final',
                  'Entrega e defesa',
                ].map((step, index) => (
                  <li key={step} className="flex items-center gap-2 text-xs text-ink">
                    <span className="tabular grid size-5 place-items-center rounded-md bg-surface-hi text-[10px] text-ink-faint">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </motion.div>

            <motion.div variants={BLOCK}>
              <MockLabel>Hábito de apoio</MockLabel>
              <MockCard>
                <p className="text-xs font-medium text-ink">Ler 20 páginas · todo dia · manhã</p>
                <p className="mt-1 text-[11px] text-ink-muted">
                  Versão mínima: 5 páginas. Leitura diária alimenta o rascunho sem depender de
                  sessão longa.
                </p>
              </MockCard>
            </motion.div>

            <motion.div variants={BLOCK}>
              <MockLabel>Primeiras ações</MockLabel>
              <MockCard className="py-1">
                <ul>
                  <MockRow
                    label="Listar as 10 referências principais"
                    meta="Etapa 1 · hoje · 30 min"
                  />
                  <MockRow
                    label="Escrever o esboço da introdução"
                    meta="Etapa 1 · quinta · 45 min"
                  />
                </ul>
              </MockCard>
            </motion.div>

            <motion.div
              variants={BLOCK}
              className="mt-4 flex items-start gap-2 rounded-lg border border-flame/30 bg-flame-dim/40 px-3 py-2"
            >
              <MockTag tone="warn">Aviso</MockTag>
              <p className="text-[11px] text-ink-muted">
                Com 45 min por dia, o prazo fica apertado. Sugestão: 14 de dezembro, ou reduzir o
                alvo da revisão.
              </p>
            </motion.div>

            <motion.div variants={BLOCK} className="mt-4 flex items-center gap-3">
              <span className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white">
                Salvar plano
              </span>
              <span className="text-xs text-ink-faint">Cada linha é editável antes disso</span>
            </motion.div>
          </motion.div>
        </Reveal>
      </div>
    </Section>
  )
}
