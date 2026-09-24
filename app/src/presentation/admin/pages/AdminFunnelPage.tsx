import { FUNNEL_STAGES } from '@/domain/analytics/funnel-events'
import { QUIZ_QUESTION_COUNT, QUIZ_INTROS, isQuizTheme } from '@/domain/entities/quiz'
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

/**
 * O funil do quiz, etapa por etapa. Cada número é gente (sessões distintas),
 * e a taxa é sempre contra a etapa anterior: é a queda entre duas etapas
 * vizinhas que diz onde mexer, não a taxa acumulada.
 */
export function AdminFunnelPage() {
  const { period } = usePeriod()
  const query = useAdminQuery(() => container.admin.quizFunnel(period), `${period.from}|${period.to}`)
  const data = query.data

  const rows = data
    ? FUNNEL_STAGES.map((stage, index) => {
        const value = data.stages[stage.event] ?? 0
        const previous = index === 0 ? null : (data.stages[FUNNEL_STAGES[index - 1]?.event ?? ''] ?? 0)
        return {
          ...stage,
          value,
          rate: previous === null ? null : previous === 0 ? null : value / previous,
        }
      })
    : []

  const visits = data?.stages['quiz_viewed'] ?? 0
  const activated = data?.stages['plan_activated'] ?? 0
  const subscribed = data?.stages['subscription_completed'] ?? 0

  return (
    <AdminPage
      title="Funil do quiz"
      description="Do carrossel até a assinatura: visitas em /criar-meu-plano, quiz concluído, cadastro, plano ativado, primeira ação, trial e assinatura. Cada etapa conta sessões distintas."
      action={<PeriodPicker />}
    >
      <QueryState loading={query.loading && !data} error={query.error} onRetry={() => void query.reload()} />

      {data ? (
        <>
          <MetricGrid cols={4}>
            <Metric label="Visitas ao quiz" value={visits} />
            <Metric label="Planos ativados" value={activated} />
            <Metric label="Visita → plano" value={visits === 0 ? null : activated / visits} format="percent" />
            <Metric label="Assinaturas" value={subscribed} hint={visits === 0 ? undefined : `${formatValue(subscribed / visits, 'percent')} das visitas`} />
          </MetricGrid>

          <Section title="Etapas" hint="Taxa = etapa atual dividida pela anterior.">
            {visits === 0 ? (
              <Empty title="Nenhuma visita no período" description="O funil começa quando alguém abre /criar-meu-plano." />
            ) : (
              <Table head={['Etapa', 'Pessoas', 'Taxa']}>
                {rows.map((row) => (
                  <tr key={row.event}>
                    <Td>{row.label}</Td>
                    <Td className="tabular">{row.value}</Td>
                    <Td className="tabular">{row.rate === null ? '-' : formatValue(row.rate, 'percent')}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </Section>

          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="Abandono por pergunta" hint="Em que pergunta a pessoa fechou a página.">
              <BarList items={data.abandoned_by_step} labelOf={stepLabel} />
            </Section>
            <Section title="Origem" hint="utm_source do link que trouxe a pessoa.">
              <BarList items={data.by_source} />
            </Section>
            <Section title="Tema" hint="O parâmetro tema= do carrossel.">
              <BarList items={data.by_theme} labelOf={themeLabel} />
            </Section>
          </div>
        </>
      ) : null}
    </AdminPage>
  )
}

function stepLabel(key: string): string {
  const step = Number(key)
  if (!Number.isFinite(step) || step < 0) return 'Sem passo'
  return step >= QUIZ_QUESTION_COUNT ? 'Depois das perguntas' : `Pergunta ${step + 1}`
}

function themeLabel(key: string): string {
  return isQuizTheme(key) ? QUIZ_INTROS[key].title : key === 'padrao' ? 'Sem tema (padrão)' : key
}
