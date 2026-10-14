import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { isInfoScreen, minutesOf, QUIZ_SCREEN_COUNT, quizScreenAt } from '@/domain/entities/quiz'
import { firstStepNow, firstStepVoice } from '@/domain/entities/quiz-first-step'
import { useAuth } from '@/presentation/auth/use-auth'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { QuizContact } from '@/presentation/quiz/QuizContact'
import { QuizFirstStep } from '@/presentation/quiz/QuizFirstStep'
import { QuizProcessing } from '@/presentation/quiz/QuizProcessing'
import { QuizQuestion } from '@/presentation/quiz/QuizQuestion'
import { QuizResult } from '@/presentation/quiz/QuizResult'
import { QuizShell } from '@/presentation/quiz/QuizShell'
import { useQuiz } from '@/presentation/quiz/use-quiz'
import { QUIZ_ACTIVATION_PATH } from '@/presentation/quiz/quiz-activation'
import { SHAKE } from '@/presentation/quiz/quiz-motion'
import { useStepTimer } from '@/presentation/quiz/use-step-timer'

/**
 * `/criar-meu-plano`: a entrada do funil, pública.
 *
 * Perguntas, análise, contato, resultado e primeiro passo, nessa ordem
 * (`use-quiz.ts`). A pessoa responde tudo e faz o primeiro passo sem conta.
 * Só depois disso vem o cadastro, e o plano vai junto (`quiz-storage`):
 * depois do login, `/app/ativar` grava exatamente o que a prévia mostrou,
 * com o passo de hoje já concluído.
 */
export function QuizPage() {
  const quiz = useQuiz()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const timer = useStepTimer()
  const reduced = useReducedMotion()
  const shake = useAnimationControls()

  // Tentar avançar sem resposta treme a pergunta: o aviso embaixo diz o que
  // falta, a tremida diz ONDE. Toda tentativa treme de novo.
  const next = () => {
    if (quiz.blocker && !reduced) void shake.start(SHAKE)
    quiz.next()
  }

  // Pra qual lado a pergunta desliza: guarda o passo anterior.
  const previousStep = useRef(quiz.step)
  const direction: 1 | -1 = quiz.step >= previousStep.current ? 1 : -1
  useEffect(() => {
    previousStep.current = quiz.step
  }, [quiz.step])

  const activate = () => {
    quiz.activate()
    // Quem já tem conta aberta não passa pelo cadastro: o plano ativa direto.
    if (!loading && user) {
      navigate(QUIZ_ACTIVATION_PATH, { replace: true })
      return
    }
    navigate('/entrar?intent=plano', { state: { from: QUIZ_ACTIVATION_PATH } })
  }

  if (quiz.phase === 'perguntas') {
    const last = quiz.step === QUIZ_SCREEN_COUNT - 1
    return (
      <QuizShell
        progress={(quiz.step + 1) / QUIZ_SCREEN_COUNT}
        progressLabel={`${quiz.step + 1} de ${QUIZ_SCREEN_COUNT}`}
        footerKey={quiz.step}
        footerDelay={isInfoScreen(quizScreenAt(quiz.step)) ? 0.9 : 0}
        footer={
          <>
            {/* Na abertura não há pra onde voltar: ela é a primeira tela. */}
            {quiz.step > 0 ? (
              <Button variant="ghost" className="shrink-0" onClick={quiz.back}>
                <Icon name="setaEsq" className="size-4" />
                Voltar
              </Button>
            ) : null}
            <div className="min-w-0 flex-1">
              {/*
                O botão fica clicável mesmo faltando resposta: botão apagado
                não explica nada, e quem toca e lê o aviso entende o que falta.
              */}
              <Button className="w-full" onClick={next}>
                {last ? 'Montar meu plano' : 'Continuar'}
                <Icon name="seta" className="size-4" />
              </Button>
            </div>
          </>
        }
      >
        <motion.div animate={shake}>
          <QuizQuestion
            step={quiz.step}
            answers={quiz.answers}
            intro={quiz.intro}
            direction={direction}
            onChange={quiz.set}
            onToggleArea={quiz.toggleArea}
            onToggleObstacle={quiz.toggleObstacle}
            onToggleWeekday={quiz.toggleWeekday}
            onSubmit={next}
          />
        </motion.div>
        <p aria-live="polite" className="mt-4 min-h-5 text-sm text-ink-faint">
          {quiz.warning ?? ''}
        </p>
      </QuizShell>
    )
  }

  if (quiz.phase === 'processando') {
    return (
      <QuizShell>
        <QuizProcessing />
      </QuizShell>
    )
  }

  if (quiz.phase === 'contato') {
    return (
      <QuizShell
        progress={1}
        progressLabel="Plano pronto"
        footer={
          <>
            <Button variant="ghost" className="shrink-0" onClick={quiz.back}>
              <Icon name="setaEsq" className="size-4" />
              Voltar
            </Button>
            <div className="min-w-0 flex-1">
              <Button className="w-full" onClick={quiz.submitLead} loading={quiz.savingLead}>
                Ver meu plano
                <Icon name="seta" className="size-4" />
              </Button>
            </div>
          </>
        }
      >
        <QuizContact
          lead={quiz.lead}
          warnings={quiz.leadWarnings}
          onChange={quiz.setLead}
          onSubmit={quiz.submitLead}
        />
      </QuizShell>
    )
  }

  if (!quiz.strategy || !quiz.preview) {
    return (
      <QuizShell>
        <QuizProcessing />
      </QuizShell>
    )
  }

  const firstStep = quiz.preview.plan.firstStep
  // O passo de agora é um só, no resultado e na tela do passo: os dois
  // mostrando tamanhos diferentes é o app discordando de si mesmo.
  const stepNow = firstStep && quiz.answers.time ? firstStepNow(firstStep, minutesOf(quiz.answers.time)) : null
  if (quiz.phase === 'primeiro-passo' && firstStep && stepNow) {
    const finish = () => {
      timer.stop()
      quiz.completeFirstStep()
    }
    return (
      <QuizShell
        footerKey={quiz.firstStepDone ? 'feito' : 'passo'}
        footerDelay={quiz.firstStepDone ? 1.1 : 0}
        footer={
          quiz.firstStepDone ? (
            <Button className="w-full" onClick={activate}>
              Salvar meu progresso
              <Icon name="seta" className="size-4" />
            </Button>
          ) : timer.running ? (
            <>
              <Button variant="ghost" className="shrink-0" onClick={timer.stop}>
                Parar
              </Button>
              <div className="min-w-0 flex-1">
                <Button className="w-full" onClick={finish}>
                  <Icon name="check" className="size-4" />
                  Terminei
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button variant="ghost" className="shrink-0" onClick={finish}>
                <Icon name="check" className="size-4" />
                Já fiz
              </Button>
              <div className="min-w-0 flex-1">
                <Button className="w-full" onClick={timer.start}>
                  <Icon name="play" className="size-4" />
                  Começar agora
                </Button>
              </div>
            </>
          )
        }
      >
        <QuizFirstStep
          step={firstStep}
          now={stepNow}
          habit={quiz.preview.habit}
          milestoneCount={quiz.preview.plan.milestones.length}
          voice={firstStepVoice(quiz.answers.tone)}
          done={quiz.firstStepDone}
          running={timer.running}
          elapsedSeconds={timer.elapsedSeconds}
          onSkip={activate}
        />
      </QuizShell>
    )
  }

  /*
    O resultado e a oferta são a mesma tela: o padrão diz onde a pessoa
    costuma falhar, a estratégia responde ponto a ponto, e o botão leva
    direto pro primeiro passo, não pra um painel vazio.
  */
  return (
    <QuizShell
      tallFooter
      footer={
        <div className="flex w-full flex-col gap-2">
          <Button className="w-full" onClick={stepNow ? quiz.startFirstStep : activate}>
            Fazer meu primeiro passo
            <Icon name="seta" className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={quiz.review}>
            Ajustar minhas respostas
          </Button>
        </div>
      }
    >
      <QuizResult
        firstName={firstNameOf(quiz.lead.name)}
        strategy={quiz.strategy}
        preview={quiz.preview}
        stepNow={stepNow}
      />
    </QuizShell>
  )
}

function firstNameOf(name: string): string | null {
  const first = name.trim().split(/\s+/)[0]
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : null
}
