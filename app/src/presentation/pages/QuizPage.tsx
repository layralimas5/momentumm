import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { dayKeyOf } from '@/domain/entities/day'
import { QUIZ_QUESTION_COUNT } from '@/domain/entities/quiz'
import { useAuth } from '@/presentation/auth/use-auth'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { QuizDiagnosisView } from '@/presentation/quiz/QuizDiagnosis'
import { QuizIntro } from '@/presentation/quiz/QuizIntro'
import { QuizPlanPreviewView } from '@/presentation/quiz/QuizPlanPreview'
import { QuizProcessing } from '@/presentation/quiz/QuizProcessing'
import { QuizQuestion } from '@/presentation/quiz/QuizQuestion'
import { QuizShell } from '@/presentation/quiz/QuizShell'
import { useQuiz } from '@/presentation/quiz/use-quiz'
import { QUIZ_ACTIVATION_PATH } from '@/presentation/quiz/quiz-activation'

/**
 * `/criar-meu-plano`: a entrada do funil, pública.
 *
 * A pessoa responde tudo sem conta. Só "Ativar meu plano no Momentumm"
 * leva pro cadastro, e o plano vai junto (`quiz-storage`): depois do login,
 * `/app/ativar` grava exatamente o que a prévia mostrou.
 */
export function QuizPage() {
  const quiz = useQuiz()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const today = useMemo(() => dayKeyOf(new Date()), [])

  // Pra qual lado a pergunta desliza: guarda o passo anterior.
  const previousStep = useRef(quiz.step)
  const direction: 1 | -1 = quiz.step >= previousStep.current ? 1 : -1
  useEffect(() => {
    previousStep.current = quiz.step
  }, [quiz.step])

  useEffect(() => {
    document.title = 'Criar meu plano · Momentumm'
  }, [])

  const activate = () => {
    quiz.activate()
    // Quem já tem conta aberta não passa pelo cadastro: o plano ativa direto.
    if (!loading && user) {
      navigate(QUIZ_ACTIVATION_PATH, { replace: true })
      return
    }
    navigate('/entrar?intent=plano', { state: { from: QUIZ_ACTIVATION_PATH } })
  }

  if (quiz.phase === 'intro') {
    return (
      <QuizShell>
        <QuizIntro copy={quiz.intro} started={quiz.started} onStart={quiz.start} />
      </QuizShell>
    )
  }

  if (quiz.phase === 'perguntas') {
    return (
      <QuizShell
        progress={(quiz.step + 1) / QUIZ_QUESTION_COUNT}
        progressLabel={`${quiz.step + 1} de ${QUIZ_QUESTION_COUNT}`}
        footer={
          <>
            <Button variant="ghost" className="shrink-0" onClick={quiz.back}>
              <Icon name="setaEsq" className="size-4" />
              Voltar
            </Button>
            <div className="min-w-0 flex-1">
              {/*
                O botão fica clicável mesmo faltando resposta: botão apagado
                não explica nada, e quem toca e lê o aviso entende o que falta.
              */}
              <Button className="w-full" onClick={quiz.next}>
                {quiz.step === QUIZ_QUESTION_COUNT - 1 ? 'Ver meu diagnóstico' : 'Continuar'}
                <Icon name="seta" className="size-4" />
              </Button>
            </div>
          </>
        }
      >
        <QuizQuestion
          step={quiz.step}
          answers={quiz.answers}
          direction={direction}
          onChange={quiz.set}
          onToggleArea={quiz.toggleArea}
          onToggleObstacle={quiz.toggleObstacle}
          onToggleWeekday={quiz.toggleWeekday}
          onSubmit={quiz.next}
        />
        <p aria-live="polite" className="mt-4 min-h-5 text-sm text-ink-faint">
          {quiz.warning ?? ''}
        </p>
      </QuizShell>
    )
  }

  if (quiz.phase === 'processando' || !quiz.diagnosis || !quiz.preview) {
    return (
      <QuizShell>
        <QuizProcessing />
      </QuizShell>
    )
  }

  if (quiz.phase === 'diagnostico') {
    return (
      <QuizShell
        footer={
          <Button className="w-full" onClick={quiz.showPlan}>
            Ver meu plano
            <Icon name="seta" className="size-4" />
          </Button>
        }
      >
        <QuizDiagnosisView diagnosis={quiz.diagnosis} />
      </QuizShell>
    )
  }

  return (
    <QuizShell
      footer={
        <div className="flex w-full flex-col gap-2">
          <Button className="w-full" onClick={activate}>
            Ativar meu plano no Momentumm
            <Icon name="seta" className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={quiz.review}>
            Ajustar minhas respostas
          </Button>
        </div>
      }
    >
      <QuizPlanPreviewView preview={quiz.preview} today={today} />
      <p className="mt-4 text-center text-xs text-ink-faint">
        Grátis pra começar, sem cartão. Sua conta nasce com 7 dias de PRO.
      </p>
    </QuizShell>
  )
}
