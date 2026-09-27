import { activityType } from '@/domain/entities/activity-type'
import { moodOption } from '@/domain/entities/checkin'
import type { DayKey } from '@/domain/entities/day'
import { formatDayLong } from '@/domain/entities/day'
import type { DaySummary } from '@/domain/entities/day-summary'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * O que aconteceu num dia.
 *
 * A faixa da semana dizia se o dia teve movimento e parava aí: sete pontos,
 * aceso ou apagado, sem jeito de perguntar o que havia atrás do ponto. Esta
 * folha é a pergunta respondida — e ela é de LEITURA. Não dá pra marcar hábito
 * de terça no sábado, nem concluir ação do passado por aqui: reescrever um dia
 * que já fechou é o caminho mais curto pra um histórico que não significa nada.
 *
 * A única exceção é hoje, que ainda está acontecendo e continua editável nos
 * cards da própria tela, logo abaixo.
 *
 * A ordem responde a pergunta na velocidade em que ela é feita: primeiro o
 * estado (como cheguei), depois o que saiu, depois o que ficou — e a vitória
 * fecha, porque é ela que a pessoa quer reler.
 */
export function DaySheet({
  summary,
  today,
  onClose,
}: {
  readonly summary: DaySummary | null
  readonly today: DayKey
  readonly onClose: () => void
}) {
  const isToday = summary?.day === today

  return (
    <BottomSheet
      open={summary !== null}
      title={summary ? formatDayLong(summary.day, today) : ''}
      description={summary ? headline(summary, isToday) : undefined}
      onClose={onClose}
    >
      {summary ? (
        <div className="flex flex-col gap-4 pb-1">
          {summary.checkIn ? (
            <Row
              icon="raio"
              tone="brand"
              label={`${moodOption(summary.checkIn.mood).label} · energia ${summary.checkIn.energy}/5`}
              hint={isToday ? 'Como você está se sentindo hoje' : 'Como você estava se sentindo'}
            />
          ) : null}

          {summary.focusMinutes > 0 ? (
            <Row
              icon="relogio"
              tone="brand"
              label={`${summary.focusMinutes} min registrados`}
              hint={
                summary.activities.length === 1
                  ? '1 registro'
                  : `${summary.activities.length} registros`
              }
            />
          ) : null}

          {summary.activities.length > 0 ? (
            <Block title="Registros">
              <ul className="flex flex-col gap-1.5">
                {summary.activities.map((activity) => {
                  const axis = activityType(activity.type)
                  return (
                    <li key={activity.id} className="flex items-center gap-2.5 text-sm">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: axis.colorToken }}
                      />
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {axis.label}
                        {activity.note ? (
                          <span className="text-ink-faint"> · {activity.note}</span>
                        ) : null}
                      </span>
                      <span className="tabular shrink-0 text-ink-muted">
                        {activity.value} {axis.unitLabel.many}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Block>
          ) : null}

          {summary.habits.length > 0 ? (
            <Block title={`Hábitos · ${summary.habitsDone} de ${summary.habits.length}`}>
              <ul className="flex flex-col gap-1.5">
                {summary.habits.map((habit) => (
                  <li key={habit.id} className="flex items-center gap-2.5 text-sm">
                    <Icon
                      name={habit.done ? 'check' : 'fechar'}
                      className={cn(
                        'size-3.5 shrink-0',
                        habit.done ? 'text-positive' : 'text-ink-faint',
                      )}
                      strokeWidth={2.5}
                    />
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate',
                        habit.done ? 'text-ink' : 'text-ink-faint',
                      )}
                    >
                      {habit.name}
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {summary.tasksDone.length > 0 ? (
            <Block title="Ações concluídas">
              <ul className="flex flex-col gap-1.5">
                {summary.tasksDone.map((task) => (
                  <li key={task.id} className="flex items-center gap-2.5 text-sm">
                    <Icon name="check" className="size-3.5 shrink-0 text-positive" strokeWidth={2.5} />
                    <span className="min-w-0 flex-1 truncate text-ink">{task.title}</span>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {summary.tasksOpen.length > 0 ? (
            <Block title={isToday ? 'Ainda em aberto' : 'Ficou em aberto'}>
              <ul className="flex flex-col gap-1.5">
                {summary.tasksOpen.map((task) => (
                  <li key={task.id} className="flex items-center gap-2.5 text-sm">
                    <span
                      aria-hidden="true"
                      className="size-3.5 shrink-0 rounded-full border border-line-hi"
                    />
                    <span className="min-w-0 flex-1 truncate text-ink-faint">{task.title}</span>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}

          {summary.win ? (
            <div className="rounded-2xl border border-brand/30 bg-brand-dim/30 px-4 py-3">
              <p className="text-[0.6875rem] font-medium tracking-[0.12em] text-brand-ink uppercase">
                Vitória do dia
              </p>
              <p className="mt-1.5 text-sm text-pretty text-ink">{summary.win.text}</p>
            </div>
          ) : null}

          {summary.empty ? (
            <p className="text-sm text-pretty text-ink-muted">
              Nada registrado nesse dia. Descanso também faz parte — e um dia em branco no meio da
              semana não apaga o que veio antes.
            </p>
          ) : null}
        </div>
      ) : null}
    </BottomSheet>
  )
}

/** A frase de abertura: o dia em uma linha, antes dos detalhes. */
function headline(summary: DaySummary, isToday: boolean): string {
  if (summary.empty) return isToday ? 'O dia ainda está em branco.' : 'Dia sem registro.'
  if (!summary.moved) return isToday ? 'Ainda nada concluído.' : 'Nada saiu nesse dia.'

  const partes: string[] = []
  if (summary.tasksDone.length > 0) {
    partes.push(
      `${summary.tasksDone.length} ${summary.tasksDone.length === 1 ? 'ação' : 'ações'}`,
    )
  }
  if (summary.habitsDone > 0) {
    partes.push(`${summary.habitsDone} ${summary.habitsDone === 1 ? 'hábito' : 'hábitos'}`)
  }
  if (summary.focusMinutes > 0) partes.push(`${summary.focusMinutes} min`)

  return partes.join(' · ')
}

function Block({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[0.6875rem] font-medium tracking-[0.12em] text-ink-faint uppercase">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function Row({
  icon,
  tone,
  label,
  hint,
}: {
  readonly icon: IconName
  readonly tone: 'brand' | 'positive'
  readonly label: string
  readonly hint: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          tone === 'positive' ? 'bg-positive/12 text-positive' : 'bg-brand-dim/70 text-brand-ink',
        )}
      >
        <Icon name={icon} className="size-4" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-faint">{hint}</span>
      </span>
    </div>
  )
}
