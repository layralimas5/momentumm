import { useRef, useState } from 'react'
import type { DayKey } from '@/domain/entities/day'
import { dayKeyToDate, formatDayLong } from '@/domain/entities/day'
import {
  addMonths,
  formatMonthLabel,
  isSameMonth,
  MONTH_WEEKDAY_LABELS,
  monthGridDays,
} from '@/domain/entities/month'
import { BottomSheet, SheetAction } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'
import type { DayPhotosView } from './use-day-photos'

interface ProfileCalendarProps {
  /** Qualquer dia do mês mostrado. */
  readonly month: DayKey
  readonly today: DayKey
  readonly onMonthChange: (month: DayKey) => void
  /** Dias em que alguma coisa se moveu. Vira o ponto embaixo do número. */
  readonly movedDays: ReadonlySet<DayKey>
  readonly album: DayPhotosView
}

/**
 * O mês em círculos — e o álbum da constância.
 *
 * Um mapa de calor diria a mesma coisa em menos espaço: dia aceso, dia
 * apagado. A diferença é que ninguém sente saudade de um quadradinho verde. A
 * foto no dia é o que transforma "22 dias em movimento" numa lembrança de quê:
 * o treino na chuva, o café das cinco, a página que terminou.
 *
 * Por isso a hierarquia é essa: quem tem foto mostra a foto e esconde o
 * número; quem não tem mostra o número e um ponto, que é o registro seco de
 * que o dia aconteceu. O dia de hoje é o único com anel.
 *
 * Dia no futuro não é tocável. Guardar foto de um dia que ainda não chegou é
 * registrar o que não aconteceu — a regra também está no domínio e no banco,
 * aqui ela só evita o toque que daria erro.
 */
export function ProfileCalendar({
  month,
  today,
  onMonthChange,
  movedDays,
  album,
}: ProfileCalendarProps) {
  const [openDay, setOpenDay] = useState<DayKey | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const days = monthGridDays(month)

  const pick = (day: DayKey) => {
    setOpenDay(day)
  }

  const chooseFile = () => fileRef.current?.click()

  return (
    <section
      aria-label={`Calendário de ${formatMonthLabel(month)}`}
      className="rounded-card border border-line bg-surface px-3 py-4"
    >
      <header className="flex items-center justify-between gap-2 px-1">
        <NavButton
          icon="setaEsq"
          label="Mês anterior"
          onClick={() => onMonthChange(addMonths(month, -1))}
        />
        <h2 className="text-base font-semibold tracking-tight text-ink">
          {formatMonthLabel(month)}
        </h2>
        <NavButton
          icon="seta"
          label="Próximo mês"
          onClick={() => onMonthChange(addMonths(month, 1))}
          /* Mês que ainda não chegou não tem o que mostrar. */
          disabled={isSameMonth(month, today)}
        />
      </header>

      <div className="mt-4 grid grid-cols-7 gap-y-1 text-center">
        {MONTH_WEEKDAY_LABELS.map((label) => (
          <span
            key={label}
            aria-hidden="true"
            className="pb-1 text-[0.625rem] font-medium tracking-wider text-ink-faint"
          >
            {label}
          </span>
        ))}

        {days.map((day) => (
          <DayCell
            key={day}
            day={day}
            inMonth={isSameMonth(day, month)}
            isToday={day === today}
            moved={movedDays.has(day)}
            photoUrl={album.urls.get(day) ?? null}
            ahead={day > today}
            onPick={() => pick(day)}
          />
        ))}
      </div>

      <div aria-live="polite" className="min-h-5 px-1">
        {album.error ? <p className="mt-2 text-sm text-danger">{album.error}</p> : null}
      </div>

      {/*
        Um input só, escondido, reaproveitado por todas as células: 35 inputs
        de arquivo numa tela seriam 35 nós ociosos e o mesmo comportamento.
      */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file && openDay) {
            void album.save(openDay, file)
            setOpenDay(null)
          }
        }}
      />

      <BottomSheet
        open={openDay !== null}
        title={openDay ? formatDayLong(openDay, today) : ''}
        description={
          openDay && album.photos.has(openDay)
            ? 'A foto que guarda esse dia.'
            : 'Guarda uma foto desse dia. Ela aparece aqui no calendário.'
        }
        onClose={() => setOpenDay(null)}
      >
        <div className="flex flex-col gap-3 pb-1">
          {openDay && album.urls.get(openDay) ? (
            <img
              src={album.urls.get(openDay)}
              alt={`Foto de ${formatDayLong(openDay, today)}`}
              className="mx-auto aspect-square w-full max-w-64 rounded-2xl object-cover"
            />
          ) : null}

          <div className="flex flex-col gap-1">
            <SheetAction
              icon={<Icon name="celular" className="size-5" />}
              label={openDay && album.photos.has(openDay) ? 'Trocar a foto' : 'Escolher uma foto'}
              hint="Uma por dia: a nova substitui a anterior"
              tone="brand"
              onClick={chooseFile}
            />
            {openDay && album.photos.has(openDay) ? (
              <SheetAction
                icon={<Icon name="lixeira" className="size-5" />}
                label="Tirar a foto"
                hint="O dia continua marcado, só sem imagem"
                onClick={() => {
                  const day = openDay
                  setOpenDay(null)
                  void album.remove(day)
                }}
              />
            ) : null}
          </div>
        </div>
      </BottomSheet>
    </section>
  )
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
        'grid size-10 shrink-0 place-items-center rounded-full border border-line text-ink-muted',
        'transition-colors active:bg-surface-hi disabled:opacity-30',
      )}
    >
      <Icon name={icon} className="size-4" />
      <span className="sr-only">{label}</span>
    </button>
  )
}

function DayCell({
  day,
  inMonth,
  isToday,
  moved,
  photoUrl,
  ahead,
  onPick,
}: {
  readonly day: DayKey
  readonly inMonth: boolean
  readonly isToday: boolean
  readonly moved: boolean
  readonly photoUrl: string | null
  readonly ahead: boolean
  readonly onPick: () => void
}) {
  const number = dayKeyToDate(day).getDate()

  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <button
        type="button"
        onClick={onPick}
        disabled={ahead}
        aria-label={`Dia ${number}${photoUrl ? ', com foto' : ''}${moved ? ', com registro' : ''}`}
        className={cn(
          'relative grid size-11 place-items-center overflow-hidden rounded-full border transition-colors',
          isToday ? 'border-brand' : 'border-line',
          !inMonth && 'opacity-35',
          ahead ? 'text-ink-faint' : 'active:bg-surface-hi',
        )}
      >
        {photoUrl ? (
          <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span
            className={cn(
              'tabular text-sm font-medium',
              isToday ? 'text-ink' : ahead ? 'text-ink-faint' : 'text-ink-muted',
            )}
          >
            {number}
          </span>
        )}
      </button>

      {/* O ponto fica FORA do círculo: dentro, ele brigaria com a foto
          justamente nos dias que têm as duas coisas. */}
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', moved && inMonth ? 'bg-brand' : 'bg-transparent')}
      />
    </div>
  )
}
