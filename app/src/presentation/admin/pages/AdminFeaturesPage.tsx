import { useMemo, useState } from 'react'
import { FEATURE_LABELS, type ProductFeature } from '@/domain/analytics/product-events'
import { container } from '@/infrastructure/container'
import {
  AdminPage,
  BarList,
  Empty,
  PeriodPicker,
  QueryState,
  Section,
  Sparkline,
  Table,
  Td,
  formatValue,
} from '../components/AdminUi'
import { useAdminQuery } from '../use-admin-query'
import { usePeriod } from '../use-period'

function labelOf(feature: string): string {
  return FEATURE_LABELS[feature as ProductFeature] ?? feature
}

export function AdminFeaturesPage() {
  const { period } = usePeriod()
  const query = useAdminQuery(() => container.admin.featureUsage(period), `${period.from}|${period.to}`)
  const data = query.data
  const [selected, setSelected] = useState<string | null>(null)

  const trend = useMemo(() => {
    if (!data) return []
    const feature = selected ?? data.features[0]?.feature
    if (!feature) return []
    const byDay = new Map(data.series.filter((row) => row.feature === feature).map((row) => [row.day, row.users]))
    const days = [...new Set(data.series.map((row) => row.day))].sort()
    return days.map((day) => byDay.get(day) ?? 0)
  }, [data, selected])

  const current = selected ?? data?.features[0]?.feature ?? null

  return (
    <AdminPage
      title="Recursos mais utilizados"
      description="Eventos de uso por recurso: quem usou, quantas vezes, em que plano e se continuou por perto. Só o evento é registrado, nunca o que a pessoa criou."
      action={<PeriodPicker />}
    >
      <QueryState loading={query.loading && !data} error={query.error} onRetry={() => void query.reload()} />

      {data ? (
        <>
          <Section title="Adoção" hint="Retenção associada = usou o recurso na primeira semana do período e continuou ativo na última.">
            {data.features.length === 0 ? (
              <Empty title="Nenhum evento de uso no período" description="Os eventos começam a ser gravados a partir desta versão do app." />
            ) : (
              <Table head={['Recurso', 'Pessoas', 'Usos', 'Por pessoa', 'Gratuito', 'PRO', 'Retenção', '']}>
                {data.features.map((feature) => (
                  <tr key={feature.feature} className={feature.feature === current ? 'bg-surface-hi/40' : undefined}>
                    <Td className="font-medium">{labelOf(feature.feature)}</Td>
                    <Td className="tabular">{feature.users}</Td>
                    <Td className="tabular">{feature.total}</Td>
                    <Td className="tabular">{formatValue(feature.per_user)}</Td>
                    <Td className="tabular">{feature.free_users}</Td>
                    <Td className="tabular">{feature.pro_users}</Td>
                    <Td className="tabular">{formatValue(feature.retention, 'percent')}</Td>
                    <Td>
                      <button type="button" onClick={() => setSelected(feature.feature)} className="text-xs text-brand-hi underline-offset-2 hover:underline">
                        Tendência
                      </button>
                    </Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title={current ? `Tendência: ${labelOf(current)}` : 'Tendência'} hint="Pessoas por dia.">
              {trend.length > 0 ? <Sparkline points={trend} label="Pessoas por dia" /> : <p className="text-sm text-ink-faint">Sem série.</p>}
            </Section>
            <Section title="Registros por tipo" hint="Texto, foto ou voz.">
              <BarList items={data.records} labelOf={(key) => ({ texto: 'Texto', foto: 'Foto', voz: 'Voz' })[key] ?? key} />
            </Section>
          </div>
        </>
      ) : null}
    </AdminPage>
  )
}
