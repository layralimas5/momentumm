import { useState } from 'react'
import type { CapacityProfile } from '@/domain/entities/checkin'
import type { Task } from '@/domain/entities/task'
import { Button } from '@/presentation/components/ui/Button'
import { BottomSheet, SheetAction } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { MomentumRing } from '@/presentation/components/dashboard/MomentumRing'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { cn } from '@/shared/lib/cn'
import type { DayProgress } from '@/presentation/planner/use-dashboard'

interface MobilePriorityProps {
  readonly task: Task | null
  /** Quanto do dia já saiu. Vira o anel ao lado do título. */
  readonly dayProgress: DayProgress
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
  dayProgress,
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
      <Panel aria-labelledby="prioridade-titulo" className="p-5">
        <Eyebrow done={dayComplete} />
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2
              id="prioridade-titulo"
              className="text-[1.375rem] leading-tight font-bold text-balance text-ink"
            >
              {dayComplete ? 'Você já fez o movimento de hoje' : 'O movimento que muda seu dia'}
            </h2>
            <p className="mt-2 text-sm text-pretty text-ink-muted">
              {dayComplete
                ? 'O plano de hoje saiu inteiro. Hoje já está resolvido.'
                : 'Escolhe uma ação só. O resto do dia fica mais leve quando existe uma decisão tomada.'}
            </p>
          </div>
          <DayRing progress={dayProgress} />
        </div>
        <Button
          size="lg"
          variant={dayComplete ? 'secondary' : 'primary'}
          className="mt-5 h-14 w-full rounded-2xl font-semibold"
          onClick={onCreate}
        >
          <Icon name="mais" className="size-4" />
          {dayComplete ? 'Planejar a próxima' : 'Definir a ação de hoje'}
        </Button>
      </Panel>
    )
  }

  const preferMinimal = capacity.preferMinimal && task.minimalVersion !== null

  return (
    <>
      {/*
        Mesma casca dos outros cards da tela.

        Ele era o único com gradiente roxo e brilho em volta, e numa tela em que
        a ação já é o maior bloco, com o único botão cheio, o realce era
        redundante: destaque que se repete em cor, tamanho e luz vira barulho. A
        hierarquia agora vem do tamanho do título e do peso do botão.
      */}
      <Panel aria-labelledby="prioridade-titulo" className="relative overflow-hidden p-5">
        <div className="flex items-start justify-between gap-3">
          <Eyebrow />
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-haspopup="dialog"
            className="-mr-2 -mt-3 grid size-11 shrink-0 place-items-center rounded-full text-line-hi transition-colors active:bg-surface-hi active:text-ink"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ⋯
            </span>
            <span className="sr-only">Opções da prioridade</span>
          </button>
        </div>

        {/* O rótulo mora na pílula acima; repetir "o que importa hoje" numa
            segunda linha empurrava o título sem dizer nada de novo. */}
        <h2 id="prioridade-titulo" className="sr-only">
          O que importa hoje
        </h2>

        {/*
          Título e anel lado a lado.

          O anel mede o DIA, não esta ação — é a resposta curta pra "quanto
          falta pra acabar", e ele mora aqui porque é aqui que a pessoa decide
          se começa mais uma. Em bloco só dele, lá embaixo, ele era placar; ao
          lado da ação, ele é argumento.
        */}
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[1.375rem] leading-tight font-bold tracking-tight text-balance text-ink">
              {task.title}
            </p>
            <p className="mt-2 text-sm text-pretty text-ink-muted">{dayLine(dayProgress)}</p>
          </div>
          <DayRing progress={dayProgress} />
        </div>

        {/*
          O tempo sai da lista de detalhes e vira pastilha: é o dado que decide
          se dá pra começar agora, e antes ele disputava atenção com eixo e
          esforço na mesma linha cinza. O resto continua secundário, abaixo.
        */}
        {/*
          Uma pastilha só: o tempo.

          Aqui havia o eixo, o esforço, a meta e a linha de etapa e objetivo —
          quatro metadados entre o título e o botão. São verdade, e nenhum deles
          muda a única pergunta que este card faz: começo ou não? O tempo fica
          porque é ele que responde "dá pra agora". O resto continua no menu de
          opções, na tela do plano e na do objetivo.
        */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="tabular inline-flex items-center gap-1.5 rounded-full border border-line-hi bg-canvas/60 px-3 py-1.5 text-sm font-medium text-ink">
            <Icon name="relogio" className="size-3.5 text-ink-faint" />~{task.estimatedMin} min
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
              className="mt-5 h-14 w-full rounded-2xl text-base font-semibold"
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
              className="relative mt-5 h-14 w-full rounded-2xl text-base font-semibold"
              onClick={() => onStartFocus(task)}
            >
              Começar agora
              {/* A seta na ponta, e não colada no texto: é ela que diz que o
                  botão leva pra outro lugar, em vez de marcar algo aqui. */}
              <Icon name="seta" className="absolute right-4 size-5" strokeWidth={2.25} />
            </Button>
            {/*
              A versão mínima vira linha de texto sob o botão. Como segundo
              botão de largura cheia ela empatava com o "começar" — duas
              chapas coladas, e a decisão do dia virando escolha múltipla.
            */}
            {task.minimalVersion ? (
              <button
                type="button"
                onClick={() => void shrink.run(task)}
                disabled={shrink.running}
                className="mx-auto mt-3 flex min-h-11 items-center gap-1.5 text-sm font-medium text-ink-faint transition-colors active:text-ink disabled:opacity-60"
              >
                <Icon name="minimo" className="size-4" />
                Fazer a versão mínima
              </button>
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

/**
 * O rótulo do bloco.
 *
 * Era uma pílula com borda, e ela competia com o título logo abaixo: dois
 * elementos marcados a 8px um do outro, e o olho sem saber qual ler primeiro.
 * Agora é etiqueta de seção — caps pequeno, espaçado, sem casca. O ponto
 * pulsante fica, porque é ele que diz que o dia ainda está em aberto.
 */
function Eyebrow({ done = false }: { done?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-[0.6875rem] font-medium tracking-[0.12em] uppercase',
        done ? 'text-positive' : 'text-ink-faint',
      )}
    >
      <span
        aria-hidden="true"
        className={done ? 'size-1.5 rounded-full bg-positive' : 'glow-pulse size-1.5 rounded-full bg-brand-hi'}
      />
      {done ? 'Dia fechado' : 'O que importa hoje'}
    </span>
  )
}

/**
 * O anel do dia: a fração concluída, no lugar em que ela muda uma decisão.
 *
 * Sem nada planejado ele não aparece — anel vazio com "0/0" no meio é um
 * gráfico que mede o nada.
 */
function DayRing({ progress }: { progress: DayProgress }) {
  if (progress.total === 0) return null

  return (
    <MomentumRing value={progress.ratio * 100} size={84} stroke={7} className="mt-0.5">
      <span className="flex flex-col items-center leading-none">
        <span aria-hidden="true" className="tabular text-lg font-semibold text-ink">
          {progress.done}/{progress.total}
        </span>
        <span aria-hidden="true" className="mt-1 text-[0.625rem] text-ink-faint">
          concluídas
        </span>
        <span className="sr-only">
          {progress.done} de {progress.total} atividades de hoje concluídas
        </span>
      </span>
    </MomentumRing>
  )
}

/** A leitura do dia em uma linha: é o que responde "vale começar mais uma?". */
function dayLine(progress: DayProgress): string {
  if (progress.total === 0) return 'Uma decisão tomada já muda o tamanho do dia.'
  const left = progress.total - progress.done
  if (left <= 0) return 'O dia já saiu inteiro. Essa aqui é lucro.'
  if (left === 1) return 'Falta pouco pra encerrar o dia com progresso real.'
  return `Faltam ${left} atividades pra fechar o dia.`
}
