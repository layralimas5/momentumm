import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { MOMENTUM_LEVEL_LABELS, type MomentumScore } from '@/domain/entities/momentum'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { cn } from '@/shared/lib/cn'

/**
 * Os três números do dia, lado a lado.
 *
 * O Momentumm ocupava um card inteiro com anel, etiqueta, sequência, frase de
 * leitura e link de detalhe: cinco informações pra responder "como estou". Aqui
 * ele é um número com o nome embaixo, do tamanho de um toque, e o resto da
 * explicação continua inteiro no detalhamento, a um toque de distância.
 *
 * Os outros dois existem porque respondem o resto da pergunta do dia sem obrigar
 * a rolar: quanto do dia já saiu e quanto tempo de foco já entrou. Três é o
 * limite: no quarto a linha vira tabela e ninguém lê tabela de relance.
 *
 * Os três levam pra tela que aprofunda o número: o Momentumm pro Progresso,
 * onde o score já aparece aberto com as regras; o dia pro Plano, onde as ações
 * são editáveis; o foco pra própria aba de Foco.
 */
export function MobileTodayStats({
  momentum,
  done,
  total,
  focusMinutes,
}: {
  readonly momentum: MomentumScore
  readonly done: number
  readonly total: number
  readonly focusMinutes: number
}) {
  const tone =
    momentum.level === 'avancando'
      ? 'positive'
      : momentum.level === 'desacelerando'
        ? 'warn'
        : 'brand'

  return (
    <section aria-label="Resumo de hoje" className="grid grid-cols-3 gap-2.5">
      <Tile to="/app/progresso" label="Momentum" icon="raio" tone={tone}>
        <p className="tabular mt-2.5 text-3xl leading-none font-semibold tracking-tight text-ink">
          {momentum.value}
        </p>
        <p className="mt-1.5 truncate text-[0.6875rem] text-ink-faint">
          {MOMENTUM_LEVEL_LABELS[momentum.level]}
        </p>
      </Tile>

      <Tile to="/app/plano" label="Hoje" icon="check" tone="positive">
        <p className="tabular mt-2.5 text-3xl leading-none font-semibold tracking-tight text-ink">
          {done}
          <span className="text-lg text-ink-faint">/{total}</span>
        </p>
        <p className="mt-1.5 truncate text-[0.6875rem] text-ink-faint">
          {total === 0 ? 'nada planejado' : done >= total ? 'dia cumprido' : 'concluídas'}
        </p>
      </Tile>

      <Tile to="/app/foco" label="Foco" icon="relogio" tone="brand">
        <p className="tabular mt-2.5 text-3xl leading-none font-semibold tracking-tight text-ink">
          {focusMinutes}
          <span className="text-lg text-ink-faint">min</span>
        </p>
        <p className="mt-1.5 truncate text-[0.6875rem] text-ink-faint">
          {focusMinutes === 0 ? 'ainda hoje' : 'registrados hoje'}
        </p>
      </Tile>
    </section>
  )
}

/** O tile inteiro é o alvo do toque: num quadrado desse tamanho, meio link é pior que link nenhum. */
function Tile({
  to,
  label,
  icon,
  tone,
  children,
}: {
  readonly to: string
  readonly label: string
  readonly icon: IconName
  readonly tone: 'brand' | 'positive' | 'warn'
  readonly children: ReactNode
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-line bg-surface px-3 py-3.5 text-left transition-colors active:bg-surface-hi"
    >
      <TileHead icon={icon} tone={tone} label={label} />
      {children}
    </Link>
  )
}

/** Ícone colorido e rótulo: é o que distingue os três de relance, antes do número. */
function TileHead({
  icon,
  tone,
  label,
}: {
  readonly icon: IconName
  readonly tone: 'brand' | 'positive' | 'warn'
  readonly label: ReactNode
}) {
  return (
    <span className="flex items-center gap-1">
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-md',
          tone === 'positive'
            ? 'bg-positive/15 text-positive'
            : tone === 'warn'
              ? 'bg-flame-dim/60 text-flame'
              : 'bg-brand-dim/60 text-brand-ink',
        )}
      >
        <Icon name={icon} className="size-3" strokeWidth={2.5} />
      </span>
      <span className="text-[0.625rem] font-medium tracking-tight text-ink-muted">{label}</span>
    </span>
  )
}
