import { useEffect, useState } from 'react'
import type { AgendaItem, DayAgenda } from '@/domain/entities/day-agenda'
import { StatusTag } from '@/presentation/components/ds/Badges'
import { Card, SectionHeader } from '@/presentation/components/ds/Card'
import { TimelineItem, type TimelineState } from '@/presentation/components/ds/Rows'
import { clockOf, formatMinutes } from './day-items'

/** O relógio da tela, de minuto em minuto: é ele que move o "AGORA". */
export function useClock(): string {
  const [clock, setClock] = useState(() => clockOf(new Date()))
  useEffect(() => {
    const id = window.setInterval(() => setClock(clockOf(new Date())), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return clock
}

/** O bloco em andamento: o último ainda aberto cujo horário já chegou. */
export function currentKey(items: readonly AgendaItem[], clock: string): string | null {
  const started = items.filter((item) => item.time && item.time <= clock && !item.done && !item.skipped)
  return started[started.length - 1]?.key ?? null
}

export function timelineStateOf(item: AgendaItem, nowKey: string | null): TimelineState {
  if (item.done || item.skipped) return 'done'
  return item.key === nowKey ? 'now' : 'next'
}

function subtitleOf(item: AgendaItem): string {
  if (item.done) return 'Concluído'
  if (item.skipped) return 'Fica pra outro dia'
  return item.minutes ? `${item.role.split(' · ')[0]} (${formatMinutes(item.minutes)})` : item.role
}

/** "Seu Dia": só o que tem horário, numa linha do tempo vertical. */
export function DayTimeline({ agenda }: { readonly agenda: DayAgenda }) {
  const clock = useClock()
  const timed = agenda.items.filter((item) => item.time)
  if (timed.length === 0) return null

  const nowKey = currentKey(timed, clock)

  return (
    <section aria-labelledby="seu-dia" className="flex scroll-mt-24 flex-col gap-3" id="seu-dia-secao">
      <SectionHeader
        id="seu-dia"
        title="Seu Dia"
        aside={`${timed.length} ${timed.length === 1 ? 'bloco programado' : 'blocos programados'}`}
      />
      <Card padded={false} className="py-4 pr-4 pl-2">
        <ol>
          {timed.map((item, index) => {
            const state = timelineStateOf(item, nowKey)
            return (
              <TimelineItem
                key={item.key}
                time={item.time ?? ''}
                title={item.title}
                subtitle={subtitleOf(item)}
                state={state}
                last={index === timed.length - 1}
                tag={state === 'now' ? <StatusTag tone="solid">AGORA</StatusTag> : null}
              />
            )
          })}
        </ol>
      </Card>
    </section>
  )
}
