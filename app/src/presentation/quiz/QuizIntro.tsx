import { motion, useReducedMotion } from 'framer-motion'
import type { QuizIntro as QuizIntroCopy } from '@/domain/entities/quiz'
import { Button } from '@/presentation/components/ui/Button'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'

/**
 * A porta do quiz. Não é landing: um título, uma frase, quatro garantias
 * e o botão. Quem chegou aqui veio de um carrossel que já fez a venda.
 */

const TRUST: readonly { readonly icon: IconName; readonly label: string }[] = [
  { icon: 'check', label: 'Gratuito para começar' },
  { icon: 'cadeado', label: 'Não precisa de cartão' },
  { icon: 'relogio', label: 'Leva menos de 2 minutos' },
  { icon: 'calendario', label: 'Seu plano será adaptado à sua rotina' },
]

interface QuizIntroProps {
  readonly copy: QuizIntroCopy
  readonly started: boolean
  readonly onStart: () => void
}

export function QuizIntro({ copy, started, onStart }: QuizIntroProps) {
  const reduced = useReducedMotion()
  const enter = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <div className="flex flex-1 flex-col justify-center py-6">
      <motion.h1
        {...enter(0)}
        className="text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl"
      >
        {copy.title}
      </motion.h1>

      <motion.p {...enter(0.08)} className="mt-4 text-base text-pretty text-ink-muted sm:text-lg">
        {copy.description}
      </motion.p>

      <motion.ul {...enter(0.16)} className="mt-8 flex flex-col gap-3" aria-label="O que você pode esperar">
        {TRUST.map((item) => (
          <li key={item.label} className="flex items-center gap-3 text-sm text-ink">
            <span className="grid size-8 shrink-0 place-items-center rounded-full border border-brand/30 bg-brand-dim/50 text-brand-ink">
              <Icon name={item.icon} className="size-4" />
            </span>
            {item.label}
          </li>
        ))}
      </motion.ul>

      <motion.div {...enter(0.24)} className="mt-10">
        <Button size="lg" className="w-full min-h-14" onClick={onStart}>
          {started ? 'Continuar de onde parei' : 'Criar meu plano'}
          <Icon name="seta" className="size-4" />
        </Button>
        <p className="mt-3 text-center text-xs text-ink-faint">
          Sete perguntas. Nada é salvo na sua conta até você decidir ativar o plano.
        </p>
      </motion.div>
    </div>
  )
}
