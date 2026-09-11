import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel, PanelHeader } from '@/presentation/components/ui/Surface'
import { AiErrorNote } from './AiErrorNote'
import { AiProposals } from './AiProposals'
import { AiQuotaNote, AiSkeleton, AiSource } from './AiBits'
import type { AiController } from './use-ai'

interface AiProgressPanelProps {
  readonly ai: AiController
  readonly title?: string
  readonly className?: string
}

/**
 * "Interpretar meu momento": o diagnóstico da IA sobre o progresso, com os
 * ajustes que ele pede já em formato aplicável.
 *
 * Diagnóstico sem tratamento é o que o produto recusa: por isso os
 * `proposals` vêm no mesmo painel, com aceitar, editar e rejeitar. A prosa
 * (padrões, gargalos, sobrecarga) explica; a lista executa.
 */
export function AiProgressPanel({ ai, title = 'Interpretar meu momento', className }: AiProgressPanelProps) {
  const call = ai.readProgress
  const reading = call.result

  return (
    <Panel tone="brand" className={className}>
      <PanelHeader
        title={title}
        icon="ia"
        hint="A IA lê os últimos 7 e 28 dias, os objetivos parados, os adiamentos e o que está planejado, e devolve o que os dados mostram."
        action={
          <Button size="sm" loading={call.loading} onClick={() => void call.run()}>
            <Icon name="ia" className="size-4" />
            {reading ? 'Ler de novo' : 'Interpretar'}
          </Button>
        }
      />

      {call.error ? <AiErrorNote className="mt-4" message={call.error} code={call.errorCode} /> : null}
      {call.loading ? <AiSkeleton className="mt-4" lines={5} /> : null}

      {reading && !call.loading ? (
        <div className="mt-4 flex flex-col gap-4">
          <p className="text-pretty text-base text-ink">{reading.summary}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <ReadingBlock title="Padrões" items={reading.patterns} />
            <ReadingBlock title="Gargalos" items={reading.bottlenecks} />
            <ReadingBlock title="Objetivos parados" items={reading.stalled} />
            <ReadingBlock title="O que ajustar" items={reading.adjustments} />
          </div>

          {reading.overload ? (
            <p className="flex gap-2.5 rounded-lg border border-flame/30 bg-flame-dim/40 px-3.5 py-3 text-sm text-ink-muted">
              <Icon name="sino" className="mt-0.5 size-4 shrink-0 text-flame" />
              <span className="text-pretty">{reading.overload}</span>
            </p>
          ) : null}

          <p className="rounded-lg bg-surface/60 px-3.5 py-3 text-sm text-ink">
            <span className="text-ink-faint">Próxima ação: </span>
            {reading.nextAction}
          </p>

          <section className="border-t border-line pt-4">
            <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Ajustes prontos pra aplicar
            </h3>
            <AiProposals
              className="mt-3"
              adjustments={reading.proposals}
              refs={ai.refs}
              emptyText="Os dados não sustentam nenhum ajuste automático agora. O que ajustar acima é leitura, não botão."
              applyLabel="Aplicar ajustes"
            />
          </section>
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-1.5 border-t border-line pt-3">
        <AiSource />
        <AiQuotaNote quota={ai.quota} simulated={ai.simulated} />
      </div>
    </Panel>
  )
}

function ReadingBlock({ title, items }: { readonly title: string; readonly items: readonly string[] }) {
  if (items.length === 0) return null
  return (
    <div className="rounded-lg border border-line bg-surface/50 px-3.5 py-3">
      <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">{title}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="text-pretty text-sm text-ink-muted">
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
