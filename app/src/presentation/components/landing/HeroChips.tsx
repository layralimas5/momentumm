import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * Os cartões que flutuam em volta do celular no hero, só no desktop.
 *
 * Cada um é um pedaço da interface de verdade, com os mesmos números da tela
 * do plano e do Progresso (modo demo): o dia que encolheu, o score subindo, a
 * sequência e o passo feito. Não é prova social, é o produto saindo da tela.
 * Decorativos (`aria-hidden`): o que eles mostram já está dito no texto da
 * página. No celular não há lateral pra eles, e o celular sozinho basta.
 */
export function HeroChips() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
      <div className="relative mx-auto h-full max-w-[1000px]">
        <Chip className="left-0 top-24" delay="0s">
          <ChipIcon tone="brand">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 8v4l2.5 2.5" />
          </ChipIcon>
          <div>
            <p className="font-medium text-ink">Dia adaptado</p>
            <p className="text-xs text-ink-muted">20 min hoje, e o dia ainda conta</p>
          </div>
        </Chip>

        <Chip className="right-0 top-36" delay="-2s">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">Momentum Score</p>
            <div className="mt-1 flex items-end gap-3">
              <p className="tabular text-3xl font-semibold leading-none text-ink">
                58<span className="text-sm font-normal text-ink-faint">/100</span>
              </p>
              <Sparkline />
            </div>
            <p className="mt-2 inline-flex rounded-full bg-brand-dim/60 px-2 py-0.5 text-xs font-medium text-brand-ink">
              +12 esta semana
            </p>
          </div>
        </Chip>

        <Chip className="left-6 top-[22rem]" delay="-4s">
          <ChipIcon tone="flame">
            <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.6.2 1.6 1 2.6 2 2.6-1-3 .3-5.8.8-8Z" />
          </ChipIcon>
          <div>
            <p className="font-medium text-ink">5 dias seguidos</p>
            <p className="text-xs text-ink-muted">Dia ruim não zera nada</p>
          </div>
        </Chip>

        <Chip className="right-4 top-[25rem]" delay="-1s">
          <ChipIcon tone="positive">
            <path d="m5 13 4 4L19 7" />
          </ChipIcon>
          <div>
            <p className="font-medium text-ink">Passo de hoje feito</p>
            <p className="text-xs text-ink-muted">Ler 20 páginas, etapa 1 de 3</p>
          </div>
        </Chip>
      </div>
    </div>
  )
}

function Chip({
  className,
  delay,
  children,
}: {
  readonly className: string
  readonly delay: string
  readonly children: ReactNode
}) {
  return (
    <div
      style={{ animationDelay: delay }}
      className={cn(
        'float-slow absolute flex items-center gap-3 rounded-2xl border border-line-hi bg-surface/80 px-4 py-3 text-sm shadow-xl shadow-black/40 backdrop-blur-md',
        className,
      )}
    >
      {children}
    </div>
  )
}

const ICON_TONE = {
  brand: 'border-brand/30 bg-brand-dim/50 text-brand-hi',
  flame: 'border-flame/30 bg-flame-dim text-flame',
  positive: 'border-positive/30 bg-positive/10 text-positive',
} as const

function ChipIcon({ tone, children }: { readonly tone: keyof typeof ICON_TONE; readonly children: ReactNode }) {
  return (
    <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl border', ICON_TONE[tone])}>
      <svg
        viewBox="0 0 24 24"
        className="size-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </span>
  )
}

function Sparkline() {
  return (
    <svg viewBox="0 0 80 32" className="h-8 w-20" fill="none">
      <defs>
        <linearGradient id="hero-spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand-hi)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--color-brand-hi)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M0 28 L18 26 L30 14 L40 18 L52 9 L64 4 L80 8 L80 32 L0 32Z" fill="url(#hero-spark)" />
      <path
        d="M0 28 L18 26 L30 14 L40 18 L52 9 L64 4 L80 8"
        stroke="var(--color-brand-hi)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
