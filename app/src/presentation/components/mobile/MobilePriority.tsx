import { useState } from 'react'
import { activityType } from '@/domain/entities/activity-type'
import type { CapacityProfile } from '@/domain/entities/checkin'
import type { Goal } from '@/domain/entities/goal'
import type { Objective } from '@/domain/entities/objective'
import { ContextLine } from '@/presentation/components/shared/Meta'
import { TASK_EFFORT_LABELS, type Task } from '@/domain/entities/task'
import { Button } from '@/presentation/components/ui/Button'
import { BottomSheet, SheetAction } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'

interface MobilePriorityProps {
  readonly task: Task | null
  readonly goal: Goal | null
  readonly objective: Objective | undefined
  readonly stageTitle?: string | null | undefined
  readonly capacity: CapacityProfile
  readonly dayComplete: boolean
  readonly onStartFocus: (task: Task) => void
  readonly onComplete: (task: Task) => Promise<void>
  readonly onShrink: (task: Task) => Promise<void>
  readonly onPostpone: (task: Task) => Promise<void>
  readonly onEdit: (task: Task) => void
  readonly onCreate: () => void
}

/**
 * A prioridade principal no celular.
 *
 * É o primeiro card grande da tela e o único com botão de largura cheia: quem
 * abre o app no meio do dia precisa conseguir começar sem ler nada. Tudo que
 * não é "começar" foi pro menu de opções, pra não competir com ele.
 */
export function MobilePriority({
  task,
  goal,
  objective,
  stageTitle,
  capacity,
  dayComplete,
  onStartFocus,
  onComplete,
  onShrink,
  onPostpone,
  onEdit,
  onCreate,
}: MobilePriorityProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const complete = useAsyncAction(async (item: Task) => {
    setMenuOpen(false)
    await onComplete(item)
  })
  const shrink = useAsyncAction(async (item: Task) => {
    setMenuOpen(false)
    await onShrink(item)
  })
  const postpone = useAsyncAction(async (item: Task) => {
    setMenuOpen(false)
    await onPostpone(item)
  })

  if (!task) {
    return (
      <Panel tone="brand" aria-labelledby="prioridade-titulo" className="p-5">
        <Eyebrow done={dayComplete} />
        <h2 id="prioridade-titulo" className="mt-3 text-xl font-semibold text-balance text-ink">
          {dayComplete ? 'Você já fez o movimento de hoje' : 'O movimento que muda seu dia'}
        </h2>
        <p className="mt-2 text-sm text-pretty text-ink-muted">
          {dayComplete
            ? 'O plano de hoje saiu inteiro. Hoje já está resolvido.'
            : 'Escolhe uma ação só. O resto do dia fica mais leve quando existe uma decisão tomada.'}
        </p>
        <Button
          size="lg"
          variant={dayComplete ? 'secondary' : 'primary'}
          className="mt-4 h-13 w-full"
          onClick={onCreate}
        >
          <Icon name="mais" className="size-4" />
          {dayComplete ? 'Planejar a próxima' : 'Definir a ação de hoje'}
        </Button>
      </Panel>
    )
  }

  const axis = task.axis ? activityType(task.axis) : null
  const preferMinimal = capacity.preferMinimal && task.minimalVersion !== null

  return (
    <>
      <Panel tone="brand" glow aria-labelledby="prioridade-titulo" className="p-5">
        <div className="flex items-start justify-between gap-3">
          <Eyebrow />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-haspopup="dialog"
            className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-ink-faint transition-colors active:bg-surface-hi"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ⋯
            </span>
            <span className="sr-only">Opções da prioridade</span>
          </button>
        </div>

        <h2
          id="prioridade-titulo"
          className="mt-2 text-xs font-semibold tracking-wide text-ink-muted uppercase"
        >
          O que importa hoje
        </h2>

        <p className="mt-2 text-2xl leading-snug font-semibold tracking-tight text-balance text-ink">
          {task.title}
        </p>

        {/* O destino por trás da ação mais importante do dia. */}
        <ContextLine
          className="mt-1.5"
          role="Ação prioritária"
          stage={stageTitle}
          objective={objective}
        />

        {/*
          O tempo sai da lista de detalhes e vira pastilha: é o dado que decide
          se dá pra começar agora, e antes ele disputava atenção com eixo e
          esforço na mesma linha cinza. O resto continua secundário, abaixo.
        */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="tabular inline-flex items-center gap-1.5 rounded-full border border-line-hi bg-canvas/50 px-2.5 py-1 text-sm font-medium text-ink">
            <Icon name="relogio" className="size-3.5 text-ink-faint" />~{task.estimatedMin} min
          </span>
          {axis ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm"
              style={{ color: axis.colorToken, borderColor: `color-mix(in oklab, ${axis.colorToken} 35%, transparent)` }}
            >
              {axis.label}
            </span>
          ) : null}
          <span className="text-sm text-ink-faint">
            {TASK_EFFORT_LABELS[task.effort].replace('Esforço ', 'esforço ')}
            {goal
              ? goal.type === task.axis
                ? ' · ligada a uma meta'
                : ` · meta de ${activityType(goal.type).label}`
              : ''}
          </span>
        </div>

        {preferMinimal ? (
          <p className="mt-4 rounded-xl border border-brand/30 bg-canvas/40 px-3.5 py-3 text-sm text-ink-muted">
            Hoje, manter o movimento importa mais do que fazer tudo. A versão mínima disso é{' '}
            <strong className="font-medium text-ink">“{task.minimalVersion}”</strong>.
          </p>
        ) : null}

        {/*
          Em dia de baixa energia a versão mínima assume o botão principal. O
          card não pode empurrar o plano cheio logo depois de a pessoa dizer que
          não tem energia — é assim que o dia termina em zero.
        */}
        {preferMinimal ? (
          <>
            <Button
              size="lg"
              className="mt-4 h-14 w-full text-base"
              onClick={() => void shrink.run(task)}
              loading={shrink.running}
            >
              <Icon name="minimo" className="size-5" />
              Fazer a versão mínima
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="mt-2 h-12 w-full"
              onClick={() => onStartFocus(task)}
            >
              <Icon name="play" className="size-4" />
              Começar mesmo assim
            </Button>
          </>
        ) : (
          <>
            <Button
              size="lg"
              className="mt-4 h-14 w-full text-base"
              onClick={() => onStartFocus(task)}
            >
              <Icon name="play" className="size-5" />
              Começar agora
            </Button>
            {task.minimalVersion ? (
              <Button
                size="lg"
                variant="secondary"
                className="mt-2 h-12 w-full"
                onClick={() => void shrink.run(task)}
                loading={shrink.running}
              >
                <Icon name="minimo" className="size-4" />
                Fazer a versão mínima
              </Button>
            ) : null}
          </>
        )}

        <div aria-live="polite" className="min-h-5">
          {complete.error || shrink.error || postpone.error ? (
            <p className="mt-2 text-sm text-danger">
              {complete.error ?? shrink.error ?? postpone.error}
            </p>
          ) : null}
        </div>
      </Panel>

      <BottomSheet
        open={menuOpen}
        title={task.title}
        description="O que você quer fazer com essa prioridade?"
        onClose={() => setMenuOpen(false)}
      >
        <div className="flex flex-col gap-1">
          <SheetAction
            icon={<Icon name="check" className="size-5" />}
            label="Concluir agora"
            hint="Já fiz, pode marcar"
            tone="brand"
            onClick={() => void complete.run(task)}
          />
          {task.minimalVersion ? (
            <SheetAction
              icon={<Icon name="minimo" className="size-5" />}
              label="Fazer a versão mínima"
              hint={task.minimalVersion}
              onClick={() => void shrink.run(task)}
            />
          ) : null}
          <SheetAction
            icon={<Icon name="adiar" className="size-5" />}
            label="Adiar pra amanhã"
            hint="Sem culpa: a ação continua viva"
            onClick={() => void postpone.run(task)}
          />
          <SheetAction
            icon={<Icon name="editar" className="size-5" />}
            label="Reorganizar"
            hint="Mudar título, tempo ou meta"
            onClick={() => {
              setMenuOpen(false)
              onEdit(task)
            }}
          />
        </div>
      </BottomSheet>
    </>
  )
}

function Eyebrow({ done = false }: { done?: boolean }) {
  return (
    <span
      className={
        done
          ? 'inline-flex items-center gap-2 rounded-full border border-positive/40 bg-positive/10 px-2.5 py-1 text-xs font-medium text-positive'
          : 'inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand-dim/50 px-2.5 py-1 text-xs font-medium text-brand-ink'
      }
    >
      <span
        aria-hidden="true"
        className={done ? 'size-1.5 rounded-full bg-positive' : 'glow-pulse size-1.5 rounded-full bg-brand-hi'}
      />
      {done ? 'Dia fechado' : 'Ação principal'}
    </span>
  )
}
