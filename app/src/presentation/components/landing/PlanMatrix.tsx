import { planMatrix } from '@/domain/entities/plan'
import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'

/**
 * A matriz completa, recurso a recurso.
 *
 * Os cards de preço dizem a frase de cada plano; a tabela responde a pergunta
 * que vem depois ("e o histórico? e a IA?") sem a pessoa precisar perguntar.
 * As linhas saem do domínio: o que está escrito aqui é o que o app aplica.
 *
 * No desktop é tabela de três colunas. No celular cada recurso vira uma
 * linha com os dois valores empilhados, que é o que cabe em 360px sem
 * esmagar a coluna do PRO.
 */
export function PlanMatrix({ className }: { readonly className?: string }) {
  const rows = planMatrix()

  return (
    <Reveal className={cn('mx-auto w-full max-w-4xl', className)}>
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        <table className="w-full text-sm">
          <caption className="sr-only">Comparação de recursos entre o plano gratuito e o PRO</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="px-4 py-3.5 text-left font-medium text-ink-muted sm:px-5">
                Recurso
              </th>
              <th scope="col" className="hidden px-4 py-3.5 text-left font-medium text-ink-muted sm:table-cell">
                Gratuito
              </th>
              <th
                scope="col"
                className="hidden bg-brand-dim/30 px-4 py-3.5 text-left font-medium text-brand-ink sm:table-cell"
              >
                PRO
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.feature} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-4 py-3 text-left align-top font-normal text-ink sm:px-5">
                  {row.feature}
                  {/* Celular: os dois valores embaixo do nome, com rótulo. */}
                  <dl className="mt-1.5 flex flex-col gap-0.5 text-xs sm:hidden">
                    <div className="flex gap-2">
                      <dt className="w-14 shrink-0 text-ink-faint">Grátis</dt>
                      <dd className="text-ink-muted">{row.free}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-14 shrink-0 text-brand-ink">PRO</dt>
                      <dd className="text-ink">{row.pro}</dd>
                    </div>
                  </dl>
                </th>
                <td className="hidden px-4 py-3 align-top text-ink-muted sm:table-cell">{row.free}</td>
                <td className="hidden bg-brand-dim/30 px-4 py-3 align-top text-ink sm:table-cell">
                  {row.pro}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Reveal>
  )
}
