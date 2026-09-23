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
  const chave = `${period.from}|${period.to}`
  const query = useAdminQuery(() => container.admin.retention(period), chave)
  /*
    O laço vem de uma segunda consulta, e não de uma junção com a primeira: as
    duas respondem perguntas diferentes (a antiga é sobre USO, a nova é sobre
    AVANÇO) e cada uma falha sozinha. Numa consulta só, um erro no funil da
    retomada apagaria as coortes da tela.
  */
  const laco = useAdminQuery(() => container.admin.engagement(period), chave)
  const dupla = useAdminQuery(() => container.admin.pairComparison(period), chave)
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

      {/* ------------------------------------------------------------------
          O laço: quem entra, quem AGE, quem volta e onde desiste.
         ------------------------------------------------------------------ */}
      <QueryState loading={laco.loading && !laco.data} error={laco.error} onRetry={() => void laco.reload()} />

      {laco.data ? (
        <>
          <Section
            title="Ativação"
            hint="Cada degrau conta pessoas da coorte do período, não eventos. O degrau que mais cai é onde o produto perde gente."
          >
            <MetricGrid cols={4}>
              <Metric label="Cadastros" value={laco.data.activation.signed_up} />
              <Metric
                label="Criaram objetivo"
                value={laco.data.activation.planned}
                hint={taxa(laco.data.activation.planned, laco.data.cohort_size)}
              />
              <Metric
                label="Viram o Hoje"
                value={laco.data.activation.saw_today}
                hint={taxa(laco.data.activation.saw_today, laco.data.cohort_size)}
              />
              <Metric
                label="Concluíram a 1ª ação"
                value={laco.data.activation.first_action}
                hint={taxa(laco.data.activation.first_action, laco.data.cohort_size)}
              />
            </MetricGrid>
          </Section>

          <Section
            title="Abriu x avançou"
            hint="Abriu = voltou ao app. Avançou = concluiu ação, hábito ou review. A distância entre as duas colunas é o que diz se o produto está funcionando ou só sendo visitado."
          >
            {laco.data.retention === null ? (
              <Empty
                title="Coorte ainda sem idade"
                description="Cada linha precisa de gente cadastrada há tempo suficiente."
              />
            ) : (
              <Table head={['Dia', 'Abriu', 'Avançou']}>
                {Object.entries(laco.data.retention)
                  .sort((a, b) => Number(a[0]) - Number(b[0]))
                  .map(([dia, valores]) => (
                    <tr key={dia}>
                      <Td className="tabular">D{dia}</Td>
                      <Td className="tabular">{formatValue(valores.opened, 'percent')}</Td>
                      <Td className="tabular">{formatValue(valores.advanced, 'percent')}</Td>
                    </tr>
                  ))}
              </Table>
            )}
          </Section>

          <div className="grid gap-5 lg:grid-cols-3">
            <Section title="Tempo até o primeiro valor" hint="Do cadastro até a primeira ação concluída.">
              <MetricGrid cols={3}>
                <Metric label="Mediana" value={laco.data.time_to_first_action_hours.median} format="hours" />
                <Metric label="P90" value={laco.data.time_to_first_action_hours.p90} format="hours" />
              </MetricGrid>
            </Section>

            <Section title="Funil da retomada" hint="Viu, começou, concluiu e voltou a avançar em até três dias.">
              <MetricGrid cols={3}>
                <Metric label="Viram" value={laco.data.recovery.shown} />
                <Metric label="Começaram" value={laco.data.recovery.started} />
                <Metric label="Concluíram" value={laco.data.recovery.completed} />
                <Metric label="Avançaram depois" value={laco.data.recovery.advanced_after} />
              </MetricGrid>
            </Section>

            <Section title="Notificações" hint="Por tipo: enviadas, abertas e seguidas de avanço.">
              {Object.keys(laco.data.notifications).length === 0 ? (
                <Empty
                  title="Nada enviado no período"
                  description="Os gatilhos ainda não entraram em produção."
                />
              ) : (
                <Table head={['Tipo', 'Env.', 'Abertas', 'Conv.']}>
                  {Object.entries(laco.data.notifications).map(([tipo, stats]) => (
                    <tr key={tipo}>
                      <Td>{tipo}</Td>
                      <Td className="tabular">{stats.sent}</Td>
                      <Td className="tabular">{stats.opened}</Td>
                      <Td className="tabular">{stats.converted}</Td>
                    </tr>
                  ))}
                </Table>
              )}
            </Section>
          </div>
        </>
      ) : null}

      {/* ------------------------------------------------------------------
          Juntos. Descritivo: os dois grupos lado a lado, sem conclusão.
         ------------------------------------------------------------------ */}
      {dupla.data ? (
        <Section
          title="Juntos: com dupla x sem dupla"
          hint="Correlação, não efeito: quem aceita um convite já é, em média, alguém mais engajado. A comparação só vira causa com um teste desenhado pra isso."
        >
          <MetricGrid cols={4}>
            <Metric label="Duplas criadas" value={dupla.data.pairs_created} />
            <Metric label="Duplas desfeitas" value={dupla.data.pairs_ended} lowerIsBetter />
            <Metric label="Incentivos" value={dupla.data.encouragements} />
            <Metric label="Convites aceitos" value={dupla.data.invites.aceito ?? 0} />
          </MetricGrid>

          <Table head={['Grupo', 'Pessoas', 'Dias com avanço (mediana)', 'D7 por avanço']}>
            {Object.entries(dupla.data.groups).map(([grupo, stats]) => (
              <tr key={grupo}>
                <Td>{grupo === 'com_dupla' ? 'Com dupla' : 'Sem dupla'}</Td>
                <Td className="tabular">{stats.users}</Td>
                <Td className="tabular">{formatValue(stats.advanced_days_median, 'int')}</Td>
                <Td className="tabular">{formatValue(stats.d7_advanced, 'percent')}</Td>
              </tr>
            ))}
          </Table>
        </Section>
      ) : null}
    </AdminPage>
  )
}

/** A taxa de um degrau do funil sobre a coorte. Traço quando não há coorte. */
function taxa(valor: number, total: number): string {
  if (total <= 0) return '—'
  return `${Math.round((valor / total) * 100)}% da coorte`
}
