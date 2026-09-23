import { Link } from 'react-router-dom'
import { ADAPTIVE_VERDICT_LABELS } from '@/domain/entities/adaptive-day'
import { cn } from '@/shared/lib/cn'
import { MockCard, MockTag } from './PhoneMockup'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'
import { trackLanding } from './landing-analytics'
import { useSiteCta } from './use-site-cta'

/**
 * O coração da página.
 *
 * Todo app de meta funciona na semana boa. O que decide se a pessoa continua
 * é o que acontece na semana ruim, e é a única coisa que nenhum concorrente
 * consegue mostrar. Por isso esta seção tem duas provas e nenhuma explicação
 * de arquitetura: o dia que encolheu e o contador que NÃO voltou pra zero.
 *
 * Os vereditos são os mesmos do domínio (`ADAPTIVE_VERDICT_LABELS`), não
 * texto escrito à mão pra landing.
 */
const VERDICTS = [
  {
    label: 'Escrever a seção de métodos',
    detail: 'Prioridade do dia · 200 palavras',
    verdict: ADAPTIVE_VERDICT_LABELS.reduzir,
    tone: 'brand' as const,
  },
  {
    label: 'Ler 20 páginas',
    detail: 'Hábito · 5 páginas',
    verdict: ADAPTIVE_VERDICT_LABELS.manter,
    tone: 'positive' as const,
  },
  {
    label: 'Montar a tabela de resultados',
    detail: 'Segunda, o dia mais vazio da sua semana',
    verdict: ADAPTIVE_VERDICT_LABELS.reagendar,
    tone: 'neutral' as const,
  },
]

export function Adaptive() {
  const cta = useSiteCta('lp-retomada')

  return (
    <Section id="retomada" className="border-t border-line">
      <SectionHeading
        eyebrow="Quando a rotina sai do eixo"
        title={
          <>
            <span className="block">O plano não deu certo hoje?</span>
            <span className="block text-brand-hi">O objetivo não precisa ir junto.</span>
          </>
        }
        description="Sua reunião atrasou. Você dormiu mal. Só tem 20 minutos. Ficou alguns dias sem conseguir avançar. O Momentumm não transforma isso em uma pilha de tarefas atrasadas: ele ajuda você a ajustar o próximo passo e continuar."
      />

      <div className="mt-12 grid gap-4 lg:grid-cols-2 lg:gap-6">
        <Reveal>
          <ShrinkCard />
        </Reveal>
        <Reveal delay={0.08}>
          <ResumeCard />
        </Reveal>
      </div>

      <Reveal delay={0.2}>
        <p className="mx-auto mt-10 max-w-2xl text-balance text-center text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Seu progresso fica. <span className="text-brand-hi">O próximo passo muda.</span>
        </p>
      </Reveal>

      <Reveal delay={0.28}>
        <div className="mt-8 flex justify-center">
          <Link
            to={cta.primary.to}
            onClick={() => trackLanding('secondary_cta_clicked')}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-7 font-medium text-white transition-colors hover:bg-brand-hi"
          >
            {cta.primary.label}
            {cta.signedIn ? null : <ArrowIcon />}
          </Link>
        </div>
      </Reveal>
    </Section>
  )
}

/** O dia que encolheu: 20 minutos e o plano cabendo neles. */
function ShrinkCard() {
  return (
    <div className="flex h-full flex-col rounded-card border border-line bg-surface p-5 sm:p-7">
      <p className="text-sm font-medium text-brand-hi">O dia apertou</p>
      <h3 className="mt-1.5 text-balance text-xl font-semibold text-ink">
        Você tem 20 minutos hoje. O plano cabe neles.
      </h3>

      <div aria-hidden="true" className="mt-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Budget label="Estava montado" value="95 min" />
          <Budget label="Você tem" value="20 min" />
          <Budget label="Fica em" value="18 min" highlight />
        </div>

        <ul className="mt-4 space-y-2.5">
          {VERDICTS.map((item) => (
            <li key={item.label} className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink">{item.label}</span>
                <span className="block truncate text-xs text-ink-faint">{item.detail}</span>
              </span>
              <span className="shrink-0 whitespace-nowrap">
                <MockTag tone={item.tone}>{item.verdict}</MockTag>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-5 text-sm text-ink-muted">
        Nada vira atraso e nenhuma sequência é encerrada.
      </p>
    </div>
  )
}

/** A retomada: o contador que não zera. */
function ResumeCard() {
  return (
    <div className="flex h-full flex-col rounded-card border border-line bg-surface p-5 sm:p-7">
      <p className="text-sm font-medium text-brand-hi">A semana sumiu</p>
      <h3 className="mt-1.5 text-balance text-xl font-semibold text-ink">
        Você volta de onde parou, não do zero.
      </h3>

      <ol aria-hidden="true" className="mt-5 flex flex-col gap-2">
        <Beat>
          <span className="tabular text-2xl font-semibold text-ink">12</span>
          <span className="text-sm text-ink-muted">ações concluídas</span>
        </Beat>

        <Gap>5 dias sem conseguir avançar</Gap>

        <MockCard tone="brand">
          <p className="text-sm font-medium text-ink">Retomar objetivo</p>
          <p className="mt-1 text-xs text-ink-muted">
            Três passos pequenos, do tamanho da semana que você tem agora.
          </p>
        </MockCard>

        <Beat highlight>
          <span className="tabular text-2xl font-semibold text-brand-hi">13</span>
          <span className="text-sm text-ink-muted">ações concluídas</span>
        </Beat>
      </ol>

      <p className="mt-5 text-sm text-ink-muted">
        O contador continua de 12. Os dias parados não são cobrados.
      </p>
    </div>
  )
}

function Budget({
  label,
  value,
  highlight = false,
}: {
  readonly label: string
  readonly value: string
  readonly highlight?: boolean
}) {
  return (
    <div className="rounded-xl bg-surface-hi px-2 py-2.5">
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className={cn('tabular text-sm font-semibold', highlight ? 'text-brand-hi' : 'text-ink')}>
        {value}
      </p>
    </div>
  )
}

function Beat({
  children,
  highlight = false,
}: {
  readonly children: React.ReactNode
  readonly highlight?: boolean
}) {
  return (
    <li
      className={cn(
        'flex items-baseline gap-2.5 rounded-2xl border px-4 py-3',
        highlight ? 'border-brand/40 bg-brand-dim/30' : 'border-line bg-surface-hi',
      )}
    >
      {children}
    </li>
  )
}

/** O intervalo, desenhado como intervalo: tracejado, sem número, sem cobrança. */
function Gap({ children }: { readonly children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-4 py-1">
      <span className="h-8 w-px border-l border-dashed border-line-hi" />
      <span className="text-xs text-ink-faint">{children}</span>
    </li>
  )
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h13M12 5l7 7-7 7" />
    </svg>
  )
}
