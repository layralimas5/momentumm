import { container } from '@/infrastructure/container'
import {
  AdminPage,
  BarList,
  Empty,
  Metric,
  MetricGrid,
  PeriodPicker,
  QueryState,
  Section,
  Table,
  Td,
  formatValue,
} from '../components/AdminUi'
import { useAdminQuery } from '../use-admin-query'
import { usePeriod } from '../use-period'

export function AdminRetentionPage() {
  const { period } = usePeriod()
  const query = useAdminQuery(() => container.admin.retention(period), `${period.from}|${period.to}`)
  const data = query.data

  return (
    <AdminPage
      title="Retenção e comportamento"
      description="Coortes por semana de cadastro, frequência de uso e o tempo até os primeiros marcos. Ativação = onboarding concluído + objetivo criado + primeira ação no Hoje."
      action={<PeriodPicker />}
    >
      <QueryState loading={query.loading && !data} error={query.error} onRetry={() => void query.reload()} />

      {data ? (
        <>
          <MetricGrid cols={5}>
            <Metric label="Ativos hoje" value={data.active.today} />
            <Metric label="Ativos 7 dias" value={data.active.d7} />
            <Metric label="Ativos 30 dias" value={data.active.d30} />
            <Metric label="Conversões pra PRO" value={data.conversions} />
            <Metric label="Cancelamentos" value={data.cancellations} lowerIsBetter />
            <Metric label="Voltaram após queda" value={data.comebacks} hint="Retomadas reconhecidas" />
            <Metric label="Modo Retomada iniciado" value={data.recovery_started} hint={`${data.recovery_users} pessoas`} />
            <Metric label="Abandonaram" value={data.churned_users} hint="Ativos antes, não no período" lowerIsBetter />
            <Metric label="Até o onboarding" value={data.time_to.onboarding_hours} format="hours" hint="mediana" />
            <Metric label="Até o 1º objetivo" value={data.time_to.first_objective_hours} format="hours" hint="mediana" />
          </MetricGrid>

          <Section title="Coortes de cadastro" hint="Retido no dia N = ativo entre o dia N e N+2 depois do cadastro. Coorte nova ainda sem idade mostra traço.">
            {data.cohorts.length === 0 ? (
              <Empty title="Nenhum cadastro no período" description="Coorte precisa de gente entrando." />
            ) : (
              <Table head={['Semana', 'Cadastros', 'Ativados', 'D1', 'D7', 'D14', 'D30']}>
                {data.cohorts.map((cohort) => (
                  <tr key={cohort.week}>
                    <Td className="tabular">{cohort.week}</Td>
                    <Td className="tabular">{cohort.size}</Td>
                    <Td className="tabular">{formatValue(cohort.activated, 'percent')}</Td>
                    <Td className="tabular">{formatValue(cohort.d1, 'percent')}</Td>
                    <Td className="tabular">{formatValue(cohort.d7, 'percent')}</Td>
                    <Td className="tabular">{formatValue(cohort.d14, 'percent')}</Td>
                    <Td className="tabular">{formatValue(cohort.d30, 'percent')}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          <div className="grid gap-5 lg:grid-cols-3">
            <Section title="Frequência" hint="Dias com uso no período, por pessoa.">
              <BarList items={data.frequency} labelOf={(key) => `${key} dias`} />
            </Section>
            <Section title="Por plano" hint="Ativos nos últimos 30 dias.">
              <Table head={['Plano', 'Pessoas', 'Ativos 30d']}>
                {Object.entries(data.by_plan).map(([plan, stats]) => (
                  <tr key={plan}>
                    <Td>{plan.toUpperCase()}</Td>
                    <Td className="tabular">{stats.users}</Td>
                    <Td className="tabular">{stats.active_30d}</Td>
                  </tr>
                ))}
              </Table>
            </Section>
            <Section title="Tempo até a primeira ação concluída">
              <p className="tabular text-2xl font-semibold text-ink">{formatValue(data.time_to.first_action_hours, 'hours')}</p>
              <p className="mt-1 text-xs text-ink-faint">mediana, a partir do cadastro</p>
            </Section>
          </div>
        </>
      ) : null}
    </AdminPage>
  )
}
