import { useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useQuizActivation } from '@/presentation/quiz/quiz-activation'
import { QUIZ_PATH } from '@/presentation/quiz/use-quiz'

/**
 * `/app/ativar`: a pessoa acabou de criar a conta com um plano do quiz
 * esperando no navegador. Esta tela grava o plano e manda pro Hoje. Ela
 * não tem interação além de "tentar de novo": tudo que havia pra decidir
 * foi decidido no quiz.
 */
export function QuizActivationPage() {
  const activation = useQuizActivation()
  const navigate = useNavigate()

  useEffect(() => {
    if (activation.status === 'pronto') navigate('/app', { replace: true })
  }, [activation.status, navigate])

  // Sem plano pendente não há o que ativar: o Hoje (ou o onboarding) assume.
  if (activation.status === 'sem-plano') return <Navigate to="/app" replace />

  return (
    <div className="mx-auto flex min-h-[60dvh] w-full max-w-md flex-col items-center justify-center py-10 text-center">
      {activation.status === 'erro' ? (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-balance text-ink">
            Não consegui ativar seu plano.
          </h1>
          <p className="mt-2 text-sm text-pretty text-ink-muted">
            Suas respostas continuam guardadas neste aparelho. Dá pra tentar de novo agora.
          </p>
          {activation.error ? (
            <div className="mt-4 w-full">
              <ErrorNote message={activation.error} />
            </div>
          ) : null}
          <div className="mt-6 flex w-full flex-col gap-2">
            <Button size="lg" className="min-h-12" onClick={activation.retry}>
              Tentar de novo
            </Button>
            <Button variant="ghost" className="min-h-10" onClick={() => navigate(QUIZ_PATH)}>
              Refazer o quiz
            </Button>
          </div>
        </>
      ) : (
        <div role="status" aria-live="polite">
          <span className="relative mx-auto grid size-16 place-items-center">
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-spin rounded-full border-2 border-line-hi border-t-brand motion-reduce:animate-none"
            />
            <Icon name="ia" className="size-6 text-brand-ink" />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance text-ink">
            Ativando seu plano…
          </h1>
          <p className="mt-2 text-sm text-pretty text-ink-muted">
            Objetivo, marcos, hábito e a ação de hoje estão entrando no seu Momentumm.
          </p>
        </div>
      )}
    </div>
  )
}
