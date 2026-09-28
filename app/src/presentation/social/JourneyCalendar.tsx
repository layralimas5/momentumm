import type { CalendarCell } from '@/domain/entities/calendar-day'
import { monthSummary } from '@/domain/entities/calendar-day'
import { dayKeyToDate, formatDayLong, type DayKey } from '@/domain/entities/day'
import {
  addMonths,
  formatMonthLabel,
  isSameMonth,
  MONTH_WEEKDAY_LABELS,
} from '@/domain/entities/month'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { cn } from '@/shared/lib/cn'
import type { CalendarView } from './use-calendar'

/**
 * O calendário visual: a jornada da pessoa, dia a dia, em fotos.
 *
 * É a experiência que diferencia o Momentumm, e a razão é simples: um mapa de
 * calor diz "dia aceso, dia apagado" e ninguém sente saudade de um quadradinho
 * verde. A foto no dia transforma "22 dias em movimento" numa lembrança de
 * QUÊ — o treino na chuva, o café das cinco, a página que terminou. Depois de
 * alguns meses, o perfil deixa de ser um painel e vira um álbum da evolução.
 *
 * ## A hierarquia da célula
 *
 *   com foto     a célula É a foto, e o número do dia fica por cima, discreto.
 *   com registro sem foto: o número, e um ponto embaixo dele.
 *   vazia        o número, apagado. Nada mais.
 *
 * ## Vazio não é punição
 *
 * Dia sem nada usa o mesmo tom do fundo: sem vermelho, sem risco, sem "você
 * faltou". A ausência num mês cheio já diz o que tem pra dizer, e um app que
 * aponta o dedo pro domingo em que a pessoa descansou é um app que ela fecha.
 * Pelo mesmo motivo a frase do mês conta o que HOUVE ("12 dias com foto"), e
 * nunca o que faltou.
 *
 * ## Quadrado, e não círculo
 *
 * O círculo do calendário antigo cortava as quatro quinas de toda foto. Num
 * mês cheio, o que se vê de longe é a MALHA — e uma malha de quadrados com
 * pouco espaço entre eles lê como um álbum, que é exatamente o que ela é.
 */
export function JourneyCalendar({
  view,
  month,
  today,
  onMonthChange,
  onPick,
  readOnly = false,
}: {
  readonly view: CalendarView
  readonly month: DayKey
  readonly today: DayKey
  readonly onMonthChange: (month: DayKey) => void
  readonly onPick: (cell: CalendarCell) => void
  /** Calendário de outra pessoa: dá pra abrir o dia, não pra registrar nele. */
  readonly readOnly?: boolean
}) {
  return (
    <section
      aria-label={`Calendário de ${formatMonthLabel(month)}`}
      className="flex flex-col gap-3"
    >
      <header className="flex items-center justify-between gap-2">
        <NavButton
          icon="setaEsq"
          label="Mês anterior"
          onClick={() => onMonthChange(addMonths(month, -1))}
        />

        <div className="min-w-0 text-center">
          <h2 className="truncate text-base font-semibold tracking-tight text-ink">
            {formatMonthLabel(month)}
          </h2>
          <p className="truncate text-xs text-ink-faint">{monthSummary(view.cells)}</p>
        </div>

        <NavButton
          icon="seta"
          label="Próximo mês"
          onClick={() => onMonthChange(addMonths(month, 1))}
          /* Mês que ainda não chegou não tem o que mostrar. */
          disabled={isSameMonth(month, today)}
        />
      </header>

      <div className="grid grid-cols-7 gap-1 text-center">
        {MONTH_WEEKDAY_LABELS.map((label) => (
          <span
            key={label}
            aria-hidden="true"
            className="pb-0.5 text-[0.625rem] font-medium tracking-wider text-ink-faint"
          >
            {label}
          </span>
        ))}

        {view.cells.map((cell) => (
          <DayCell
            key={cell.day}
            cell={cell}
            today={today}
            cover={view.covers.get(cell.day) ?? null}
            loading={view.loading}
            readOnly={readOnly}
            onPick={() => onPick(cell)}
          />
        ))}
      </div>

      <div aria-live="polite" className="min-h-0">
        {view.error ? <ErrorNote message={view.error} onRetry={view.reload} /> : null}
      </div>
    </section>
  )
}

function DayCell({
  cell,
  today,
  cover,
  loading,
  readOnly,
  onPick,
}: {
  readonly cell: CalendarCell
  readonly today: DayKey
  readonly cover: string | null
  readonly loading: boolean
  readonly readOnly: boolean
  readonly onPick: () => void
}) {
  const number = dayKeyToDate(cell.day).getDate()
  const hasImage = cell.coverPath !== null

  /* Dia futuro nunca é tocável; num calendário alheio, dia sem nada também
     não: não há o que abrir, e um toque que não responde parece defeito. */
  const disabled = cell.ahead || (readOnly && cell.kind === 'vazio')

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-label={describe(cell, number, today)}
      className={cn(
        'relative aspect-square overflow-hidden rounded-lg border transition-colors',
        cell.isToday ? 'border-brand' : 'border-transparent',
        !cell.inMonth && 'opacity-30',
        hasImage
          ? 'bg-surface-hi'
          : cell.kind === 'movimento'
            ? 'bg-surface-hi'
            : 'bg-surface/60',
        !disabled && 'active:brightness-110',
      )}
    >
      {hasImage && cover ? (
        <>
          <img src={cover} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" />
          {/* Uma sombra só embaixo: sem ela o número some numa foto clara, e
              um véu sobre a imagem inteira apagaria o álbum. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent"
          />
          <span className="absolute bottom-0.5 left-1 text-[0.625rem] font-medium text-white tabular drop-shadow">
            {number}
          </span>
        </>
      ) : hasImage && loading ? (
        <span aria-hidden="true" className="absolute inset-0 animate-pulse bg-surface-top/60" />
      ) : (
        <span
          className={cn(
            'grid size-full place-items-center text-xs tabular',
            cell.isToday
              ? 'font-semibold text-ink'
              : cell.kind === 'movimento'
                ? 'text-ink-muted'
                : 'text-ink-faint',
          )}
        >
          {number}
        </span>
      )}

      {/* Vários registros no mesmo dia: duas camadas no canto, discretas. É o
          sinal de "tem mais aqui dentro", e ele precisa sobreviver por cima de
          qualquer foto. */}
      {cell.postCount > 1 ? (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 grid size-4 place-items-center rounded-[0.25rem] bg-black/55 text-[0.5rem] font-semibold text-white tabular backdrop-blur-sm"
        >
          {cell.postCount > 9 ? '9+' : cell.postCount}
        </span>
      ) : null}

      {/* O ponto do dia que andou sem foto. Ele NÃO aparece sobre imagem: ali a
          própria foto já é a prova de que o dia aconteceu. */}
      {!hasImage && cell.kind === 'movimento' ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-1 mx-auto size-1 rounded-full bg-brand"
        />
      ) : null}
    </button>
  )
}

/**
 * O que o leitor de tela ouve.
 *
 * A cor e a foto não chegam nele, então o estado vai em palavra: "com foto",
 * "com registro", "sem registro". Sem isso a grade inteira seria trinta
 * botões chamados "12", "13", "14".
 */
function describe(cell: CalendarCell, number: number, today: DayKey): string {
  const when = formatDayLong(cell.day, today)
  if (cell.ahead) return `${when}, ainda não chegou`

  const estado =
    cell.kind === 'publicacao'
      ? cell.postCount > 1
        ? `com ${cell.postCount} publicações`
        : 'com publicação'
      : cell.kind === 'album'
        ? 'com foto guardada'
        : cell.kind === 'movimento'
          ? 'com registro, sem foto'
          : 'sem registro'

  return `Dia ${number}, ${when}, ${estado}`
}

function NavButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  readonly icon: 'seta' | 'setaEsq'
  readonly label: string
  readonly onClick: () => void
  readonly disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-full border border-line text-ink-muted',
        'transition-colors active:bg-surface-hi disabled:opacity-30',
      )}
    >
      <Icon name={icon} className="size-4" />
      <span className="sr-only">{label}</span>
    </button>
  )
}
