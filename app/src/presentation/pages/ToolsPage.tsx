import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BUILTIN_ACTIVITY_TYPE_LIST, activityType, type ActivityTypeSlug } from '@/domain/entities/activity-type'
import { dayKeyOf, daysBetween, parseDayKey } from '@/domain/entities/day'
import { SiteFooter } from '@/presentation/components/landing/SiteFooter'
import { SiteHeader } from '@/presentation/components/landing/SiteHeader'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { cn } from '@/shared/lib/cn'

/**
 * Ferramentas abertas, sem login. Existem por dois motivos: resolvem uma conta
 * chata de fazer na mão e são a porta de entrada orgânica (cada uma responde a
 * uma busca real do Google).
 */
export function ToolsPage() {
  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <SiteHeader />

      <main id="conteudo" className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:pt-40">
        <header>
          <p className="text-sm font-medium tracking-wide text-brand-hi uppercase">Ferramentas</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Contas que você faria na mão, prontas.
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-lg text-ink-muted">
            Grátis e sem cadastro. Se quiser que o número vire acompanhamento de verdade, o app
            registra pra você.
          </p>
        </header>

        <div className="mt-14 flex flex-col gap-12">
          <ReadingGoalTool />
          <TimeGoalTool />
          <StreakTool />
        </div>

        <section className="mt-16 rounded-card border border-line bg-surface p-8 text-center">
          <h2 className="text-balance text-2xl font-semibold tracking-tight text-ink">
            A conta é a parte fácil. O difícil é manter.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-pretty text-ink-muted">
            No Momentumm esse número vira meta, e a meta soma sozinha a cada registro.
          </p>
          <Link
            to="/entrar"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 font-medium text-white transition-colors hover:bg-brand-hi"
          >
            Criar conta grátis
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function ToolShell({
  id,
  title,
  description,
  children,
  result,
}: {
  id: string
  title: string
  description: string
  children: React.ReactNode
  result: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-card border border-line bg-surface p-6 sm:p-8">
      <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 text-pretty text-sm text-ink-muted">{description}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">{children}</div>

      <div aria-live="polite" className="mt-6 rounded-xl border border-line bg-surface-hi p-5">
        {result}
      </div>
    </section>
  )
}

function Highlight({ value, unit, note }: { value: string; unit: string; note: string }) {
  return (
    <>
      <p className="flex items-baseline gap-2">
        <span className="tabular text-4xl font-semibold text-ink">{value}</span>
        <span className="text-sm text-ink-muted">{unit}</span>
      </p>
      <p className="mt-2 text-pretty text-sm text-ink-faint">{note}</p>
    </>
  )
}

function ReadingGoalTool() {
  const today = dayKeyOf(new Date())
  const [pages, setPages] = useState('320')
  const [read, setRead] = useState('0')
  const [deadline, setDeadline] = useState<string>(() => {
    const date = new Date()
    date.setDate(date.getDate() + 30)
    return dayKeyOf(date)
  })

  const result = useMemo(() => {
    const total = Number(pages)
    const done = Number(read)
    if (!Number.isFinite(total) || total <= 0) return null

    const remaining = Math.max(0, total - (Number.isFinite(done) ? done : 0))
    let days: number
    try {
      days = daysBetween(today, parseDayKey(deadline))
    } catch {
      return null
    }
    if (days < 0) return null

    const effectiveDays = Math.max(1, days)
    return {
      remaining,
      days: effectiveDays,
      perDay: Math.ceil(remaining / effectiveDays),
      minutes: Math.round((remaining / effectiveDays) * 1.5),
    }
  }, [pages, read, deadline, today])

  return (
    <ToolShell
      id="leitura"
      title="Meta de leitura"
      description="Quantas páginas por dia você precisa ler pra terminar o livro até uma data."
      result={
        result ? (
          <Highlight
            value={String(result.perDay)}
            unit={result.perDay === 1 ? 'página por dia' : 'páginas por dia'}
            note={`Faltam ${result.remaining} páginas em ${result.days} ${result.days === 1 ? 'dia' : 'dias'}. Dá mais ou menos ${result.minutes} minutos de leitura por dia.`}
          />
        ) : (
          <p className="text-sm text-ink-muted">Preencha os campos pra ver o resultado.</p>
        )
      }
    >
      <Field label="Páginas do livro">
        {(id) => (
          <TextInput
            id={id}
            type="number"
            inputMode="numeric"
            min={1}
            value={pages}
            onChange={(event) => setPages(event.target.value)}
          />
        )}
      </Field>

      <Field label="Páginas já lidas">
        {(id) => (
          <TextInput
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            value={read}
            onChange={(event) => setRead(event.target.value)}
          />
        )}
      </Field>

      <Field label="Terminar até">
        {(id) => (
          <TextInput
            id={id}
            type="date"
            min={today}
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className="sm:col-span-2"
          />
        )}
      </Field>
    </ToolShell>
  )
}

function TimeGoalTool() {
  const [axis, setAxis] = useState<ActivityTypeSlug>('estudo')
  const [hours, setHours] = useState('20')
  const [daysPerWeek, setDaysPerWeek] = useState('5')

  const result = useMemo(() => {
    const totalMinutes = Number(hours) * 60
    const perWeek = Number(daysPerWeek)
    if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return null
    if (!Number.isFinite(perWeek) || perWeek <= 0 || perWeek > 7) return null

    // Um mês tem cerca de 4,33 semanas.
    const sessions = Math.max(1, Math.round(perWeek * 4.33))
    const perSession = Math.ceil(totalMinutes / sessions)

    return { sessions, perSession, hoursPerYear: Math.round((totalMinutes * 12) / 60) }
  }, [hours, daysPerWeek])

  const type = activityType(axis)

  return (
    <ToolShell
      id="tempo"
      title="Meta de tempo"
      description="Quantos minutos por sessão pra bater sua meta mensal de estudo, treino ou meditação."
      result={
        result ? (
          <Highlight
            value={String(result.perSession)}
            unit="minutos por sessão"
            note={`São ${result.sessions} sessões de ${type.label.toLowerCase()} no mês. Mantendo o ano inteiro, dá ${result.hoursPerYear} horas.`}
          />
        ) : (
          <p className="text-sm text-ink-muted">Preencha os campos pra ver o resultado.</p>
        )
      }
    >
      <Field label="Eixo">
        {(id) => (
          <Select
            id={id}
            value={axis}
            onChange={(event) => setAxis(event.target.value as ActivityTypeSlug)}
          >
            {BUILTIN_ACTIVITY_TYPE_LIST.filter((item) => item.unit === 'minutos').map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Horas no mês">
        {(id) => (
          <TextInput
            id={id}
            type="number"
            inputMode="numeric"
            min={1}
            value={hours}
            onChange={(event) => setHours(event.target.value)}
          />
        )}
      </Field>

      <Field label="Dias por semana" hint="De 1 a 7.">
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            type="number"
            inputMode="numeric"
            min={1}
            max={7}
            value={daysPerWeek}
            onChange={(event) => setDaysPerWeek(event.target.value)}
          />
        )}
      </Field>
    </ToolShell>
  )
}

function StreakTool() {
  const [current, setCurrent] = useState('12')
  const [record, setRecord] = useState('24')

  const result = useMemo(() => {
    const now = Number(current)
    const best = Number(record)
    if (!Number.isFinite(now) || now < 0 || !Number.isFinite(best) || best < 0) return null

    const missing = Math.max(0, best - now + 1)
    const date = new Date()
    date.setDate(date.getDate() + missing)

    return {
      missing,
      beatsToday: missing === 0,
      date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' }),
    }
  }, [current, record])

  return (
    <ToolShell
      id="sequencia"
      title="Calendário de sequência"
      description="Quantos dias faltam pra você bater o próprio recorde, e em que data isso acontece."
      result={
        result ? (
          result.beatsToday ? (
            <Highlight value="Hoje" unit="" note="Registrando hoje você já supera seu recorde." />
          ) : (
            <Highlight
              value={String(result.missing)}
              unit={result.missing === 1 ? 'dia' : 'dias'}
              note={`Sem falhar nenhum dia, você bate o recorde em ${result.date}.`}
            />
          )
        ) : (
          <p className="text-sm text-ink-muted">Preencha os campos pra ver o resultado.</p>
        )
      }
    >
      <Field label="Sequência atual">
        {(id) => (
          <TextInput
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        )}
      </Field>

      <Field label="Seu recorde">
        {(id) => (
          <TextInput
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            value={record}
            onChange={(event) => setRecord(event.target.value)}
          />
        )}
      </Field>

      <p className={cn('text-xs text-ink-faint sm:col-span-2')}>
        No app essa conta é automática: a sequência e o recorde vêm dos teus registros.
      </p>
    </ToolShell>
  )
}
