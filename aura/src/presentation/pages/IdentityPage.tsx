import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Pencil, Sparkles } from 'lucide-react'
import {
  IDENTITY_QUESTIONS,
  IdentityRules,
  type Identity,
  type IdentityAnswers,
} from '@/domain/entities/identity'
import { useIdentity } from '@/presentation/hooks/use-identity'
import { Card } from '@/presentation/components/ui/Card'
import { Button } from '@/presentation/components/ui/Button'

export function IdentityPage() {
  const { identity, loading, save } = useIdentity()
  const [params] = useSearchParams()
  const [editing, setEditing] = useState(false)

  if (loading) {
    return <p className="text-sm text-zinc-500">Carregando...</p>
  }

  // Onboarding quando não há identidade, ou edição sob demanda / via ?refazer.
  const showWizard = !identity || editing || params.get('refazer') === '1'

  if (showWizard) {
    return (
      <IdentityWizard
        initial={identity ?? IdentityRules.emptyAnswers()}
        firstTime={!identity}
        onSave={save}
      />
    )
  }

  return <IdentityManifesto identity={identity} onEdit={() => setEditing(true)} />
}

function IdentityWizard({
  initial,
  firstTime,
  onSave,
}: {
  initial: IdentityAnswers
  firstTime: boolean
  /** Não lança: devolve `true` quando a gravação deu certo. */
  onSave: (answers: IdentityAnswers) => Promise<boolean>
}) {
  const reduce = useReducedMotion()
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<IdentityAnswers>(initial)
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const question = IDENTITY_QUESTIONS[step]!
  const value = answers[question.key]
  const isLast = step === IDENTITY_QUESTIONS.length - 1
  const canAdvance = value.trim().length > 0
  const total = IDENTITY_QUESTIONS.length

  function update(text: string) {
    setAnswers((prev) => ({ ...prev, [question.key]: text }))
  }

  async function goNext() {
    if (!canAdvance) return
    if (!isLast) {
      setStep((s) => s + 1)
      return
    }
    setSubmitting(true)
    setError(null)
    const saved = await onSave(answers)
    if (!saved) {
      setError('Não consegui salvar sua identidade. Tente de novo.')
      setSubmitting(false)
      return
    }
    navigate('/app')
  }

  const enter = reduce ? {} : { opacity: 0, x: 24 }
  const center = { opacity: 1, x: 0 }
  const exit = reduce ? {} : { opacity: 0, x: -24 }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header>
        <p className="flex items-center gap-2 text-sm font-medium text-brand-400">
          <Sparkles className="h-4 w-4" /> Identidade futura
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl dark:text-zinc-50">
          {firstTime
            ? 'Vamos desenhar a mulher que você decidiu se tornar.'
            : 'Reveja a mulher que você decidiu se tornar.'}
        </h1>
        <p className="mt-2 text-pretty text-zinc-600 dark:text-zinc-400">
          Responda com sinceridade — é essa mulher que o Aura vai te lembrar de ser, todos os dias.
        </p>
      </header>

      {/* Progresso */}
      <div>
        <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
          <span>
            Passo {step + 1} de {total}
          </span>
          <span>{Math.round(((step + 1) / total) * 100)}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-blush-400 transition-[width] duration-500 ease-out"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <Card className="p-6 sm:p-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={question.key}
            initial={enter}
            animate={center}
            exit={exit}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <label htmlFor={`q-${question.key}`} className="block">
              <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {question.label}
              </span>
              <span className="mt-1 block text-sm text-zinc-500 dark:text-zinc-400">
                {question.hint}
              </span>
            </label>
            <textarea
              id={`q-${question.key}`}
              value={value}
              onChange={(e) => update(e.target.value)}
              placeholder={question.placeholder}
              rows={4}
              autoFocus
              className="mt-4 w-full resize-y rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </motion.div>
        </AnimatePresence>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || submitting}
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button onClick={goNext} disabled={!canAdvance || submitting}>
            {isLast ? (
              <>
                <Check className="h-4 w-4" />
                {submitting ? 'Salvando...' : 'Concluir'}
              </>
            ) : (
              <>
                Continuar <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function IdentityManifesto({
  identity,
  onEdit,
}: {
  identity: Identity
  onEdit: () => void
}) {
  const reduce = useReducedMotion()
  const rise = useMemo(
    () =>
      reduce
        ? {}
        : {
            initial: { opacity: 0, y: 12 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
          },
    [reduce],
  )

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <motion.header {...rise} className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-brand-400">
            <Sparkles className="h-4 w-4" /> Identidade futura
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 md:text-3xl dark:text-zinc-50">
            A mulher que você decidiu se tornar
          </h1>
        </div>
        <Button variant="secondary" size="sm" onClick={onEdit} className="shrink-0">
          <Pencil className="h-4 w-4" /> Editar
        </Button>
      </motion.header>

      {/* Frase-âncora */}
      <motion.section {...rise} aria-label="Sua identidade">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-500 to-blush-500 p-6 text-white sm:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/15 blur-3xl"
          />
          <p className="max-w-xl text-pretty text-lg font-medium leading-snug sm:text-xl">
            Você decidiu se tornar {identity.becoming}.
          </p>
        </div>
      </motion.section>

      <motion.dl {...rise} className="grid gap-4">
        {IDENTITY_QUESTIONS.map((q) => (
          <Card key={q.key} className="p-5">
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{q.label}</dt>
            <dd className="mt-1 text-pretty text-zinc-900 dark:text-zinc-50">{identity[q.key]}</dd>
          </Card>
        ))}
      </motion.dl>

      <Link
        to="/app"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-500 hover:text-brand-400"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar pra jornada
      </Link>
    </div>
  )
}
