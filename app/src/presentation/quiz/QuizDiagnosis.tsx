import { motion, useReducedMotion } from 'framer-motion'
import type { QuizDiagnosis as Diagnosis } from '@/domain/entities/quiz'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'

/**
 * O diagnóstico: o perfil de execução e a explicação montada com as
 * respostas. Cada linha da lista carrega a resposta que a produziu, pra a
 * pessoa reconhecer que aquilo veio dela e não de um texto pronto.
 */

interface QuizDiagnosisProps {
  readonly diagnosis: Diagnosis
}

export function QuizDiagnosisView({ diagnosis }: QuizDiagnosisProps) {
  const reduced = useReducedMotion()
  const enter = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as const },
        }

  const rows: readonly { readonly icon: IconName; readonly label: string; readonly value: string }[] = [
    { icon: 'objetivo', label: 'Objetivo identificado', value: diagnosis.goal },
    { icon: 'raio', label: 'Principal dificuldade', value: diagnosis.obstacle },
    { icon: 'relogio', label: 'Tempo disponível', value: diagnosis.time },
    { icon: 'plano', label: 'Estilo de execução recomendado', value: diagnosis.styleLabel },
  ]

  return (
    <div className="flex flex-col py-2">
      <motion.p {...enter(0)} className="text-xs font-medium tracking-wide text-brand-ink uppercase">
        Seu perfil de execução
      </motion.p>
      <motion.h1
        {...enter(0.05)}
        className="mt-2 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl"
      >
        {diagnosis.profile}.
      </motion.h1>

      <motion.p {...enter(0.12)} className="mt-5 text-base text-pretty text-ink-muted sm:text-lg">
        {diagnosis.explanation}
      </motion.p>

      <motion.dl {...enter(0.2)} className="mt-8 flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface/60">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3 px-4 py-3.5">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-brand/30 bg-brand-dim/50 text-brand-ink">
              <Icon name={row.icon} className="size-4" />
            </span>
            <div className="min-w-0">
              <dt className="text-xs text-ink-faint">{row.label}</dt>
              <dd className="mt-0.5 text-sm font-medium text-pretty text-ink">{row.value}</dd>
            </div>
          </div>
        ))}
      </motion.dl>
    </div>
  )
}
