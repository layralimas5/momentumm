import { Link } from 'react-router-dom'
import { PRO_PRICES, formatBRL } from '@/domain/billing/billing-plans'
import { achievementSpec, ACHIEVEMENT_KEYS, levelSpecOf } from '@/domain/entities/evolution'
import { container } from '@/infrastructure/container'
import {
  AdminPage,
  Metric,
  MetricGrid,
  PeriodPicker,
  QueryState,
  Section,
  Sparkline,
  StatusTag,
  formatValue,
} from '../components/AdminUi'
import { useAdminQuery } from '../use-admin-query'
import { usePeriod } from '../use-period'

export function AdminOverviewPage() {
  const { period } = usePeriod()
  const query = useAdminQuery(() => container.admin.overview(period), `${period.from}|${period.to}`)
  const data = query.data
  const evolution = useAdminQuery(() => container.admin.evolutionMetrics(), 'evolution')
  const revenue = useAdminQuery(() => container.admin.revenue(period), `revenue:${period.from}|${period.to}`)

  return (
    <AdminPage
      title="Visão geral"
      description="Operação, saúde e crescimento do Momentumm. Todo número vem do banco; comparação com o período imediatamente anterior, do mesmo tamanho."
      action={<PeriodPicker />}
    >
      <QueryState loading={query.loading && !data} error={query.error} onRetry={() => void query.reload()} />

      {data ? (
        <>
          <Section title="Base" hint="Totais de agora, sem período.">
            <MetricGrid cols={5}>
              <Metric label="Usuários cadastrados" value={data.totals.users} />
              <Metric label="Ativos hoje" value={data.totals.active_today} />
              <Metric label="Ativos 7 dias" value={data.totals.active_7d} />
              <Metric label="Ativos 30 dias" value={data.totals.active_30d} />
              <Metric
                label="Gratuito / PRO"
                value={data.totals.pro_users}
                hint={`${formatValue(data.totals.free_users)} gratuitos · ${formatValue(data.totals.pro_users)} PRO`}
              />
            </MetricGrid>
          </Section>

          <Section title="No período" hint={`${period.from} a ${period.to}, contra o bloco anterior.`}>
            <MetricGrid cols={5}>
              <Metric label="Novos usuários" value={data.current.new_users} previous={data.previous.new_users} />
              <Metric label="Usuários ativos" value={data.current.active_users} previous={data.previous.active_users} />
              <Metric label="Onboarding concluído" value={data.current.onboarding_completed} previous={data.previous.onboarding_completed} />
              <Metric label="Ativados" value={data.current.activated} previous={data.previous.activated} />
              <Metric label="Retenção" value={data.current.retention_rate} previous={data.previous.retention_rate} format="percent" />
              <Metric label="Novas assinaturas" value={data.current.new_subscriptions} previous={data.previous.new_subscriptions} />
              <Metric label="Cancelamentos" value={data.current.cancellations} previous={data.previous.cancellations} lowerIsBetter />
              <Metric label="Chamadas de IA" value={data.current.ai_calls} previous={data.previous.ai_calls} />
              <Metric label="Pessoas usando IA" value={data.current.ai_users} previous={data.previous.ai_users} />
              <Metric label="Erros" value={data.current.errors} previous={data.previous.errors} lowerIsBetter />
            </MetricGrid>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SeriesCard label="Ativos por dia" points={data.series.map((day) => day.active)} />
              <SeriesCard label="Novos por dia" points={data.series.map((day) => day.new_users)} />
            </div>
          </Section>

          <Section
            title="Dinheiro"
            hint={`Cobranças que o Asaas confirmou entre ${period.from} e ${period.to}. Caixa do período, não projeção — MRR e ARR são a projeção, e ficam à parte.`}
          >
            <QueryState loading={revenue.loading && !revenue.data} error={revenue.error} onRetry={() => void revenue.reload()} />
            {revenue.data ? (
              <>
                <MetricGrid cols={4}>
                  <Metric label="Recebido no período" value={revenue.data.net_cents} format="brl" hint="Já sem reembolso" />
                  <Metric label="Bruto" value={revenue.data.gross_cents} format="brl" hint={`${formatValue(revenue.data.payments)} cobrança(s)`} />
                  <Metric label="Reembolsado" value={revenue.data.refunds_cents} format="brl" lowerIsBetter />
                  <Metric label="Ticket médio" value={revenue.data.ticket_cents ?? 0} format="brl" />
                  <Metric label="MRR" value={revenue.data.mrr_cents} format="brl" hint="Só assinatura ativa" />
                  <Metric label="ARR" value={revenue.data.arr_cents} format="brl" hint="MRR x 12" />
                  <Metric label="Quem pagou" value={revenue.data.paying_users} hint="Pessoas distintas no período" />
                  <Metric label="Em teste agora" value={revenue.data.trials_active} hint="Não entra no MRR" />
                </MetricGrid>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <SeriesCard label="Recebido por dia" points={revenue.data.series.map((day) => day.cents)} />
                  <div className="rounded-card border border-line bg-surface p-4">
                    <p className="text-xs text-ink-faint">Preço vigente do PRO</p>
                    <ul className="mt-2 flex flex-col gap-1.5 text-sm text-ink">
                      {Object.values(PRO_PRICES).map((price) => (
                        <li key={price.cycle} className="flex items-center justify-between gap-3">
                          <span className="capitalize text-ink-muted">{price.cycle}</span>
                          <span className="tabular font-medium">
                            {formatBRL(price.amountCents)}
                            <span className="ml-2 text-xs text-ink-faint">
                              {formatBRL(revenue.data?.by_cycle[price.cycle] ?? 0)} no período
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-ink-faint">
                      O mesmo preço que a landing e o checkout usam. Mudar exige deploy, de propósito.
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-ink-faint">
                  Taxa do Asaas não está descontada: o provedor não manda o valor líquido no evento que a
                  gente guarda. Pra lucro de verdade falta isso e o custo de infraestrutura.
                </p>
              </>
            ) : null}
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Assinaturas" hint="Quem está PRO agora.">
              <MetricGrid cols={3}>
                <Metric label="Assinaturas ativas" value={data.totals.active_subscriptions} />
                <Metric label="Conversão pra PRO" value={data.totals.conversion_rate} format="percent" />
                <Metric label="PRO" value={data.totals.pro_users} />
              </MetricGrid>
            </Section>

            <Section title="Pendências" hint="O que precisa de alguém hoje.">
              <MetricGrid cols={3}>
                <Metric label="Solicitações pendentes" value={data.totals.requests_pending} />
                <Metric label="Fora do prazo" value={data.totals.requests_overdue} />
                <Metric label="Erros em aberto" value={data.totals.errors_open} />
              </MetricGrid>
              {data.totals.active_access_grants > 0 ? (
                <p className="mt-3 rounded-xl border border-flame/30 bg-flame-dim/30 px-3.5 py-2.5 text-sm text-ink">
                  <strong>{data.totals.active_access_grants}</strong> acesso(s) excepcional(is) a conteúdo pessoal
                  ativo(s) agora.{' '}
                  <Link to="/admin/solicitacoes" className="underline-offset-2 hover:underline">
                    Ver solicitações
                  </Link>
                </p>
              ) : null}
            </Section>
          </div>

          <Section title="Evolução" hint="XP e níveis, só em agregado. O histórico de cada pessoa fica com ela.">
            {evolution.data ? (
              <>
                <MetricGrid cols={4}>
                  <Metric label="Pessoas com XP" value={evolution.data.people} />
                  <Metric label="XP total da base" value={evolution.data.xpTotal} />
                  <Metric label="XP nesta semana" value={evolution.data.xpThisWeek} />
                  <Metric label="Ativas na semana" value={evolution.data.activeThisWeek} />
                </MetricGrid>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-card border border-line bg-surface p-4">
                    <p className="text-xs text-ink-faint">Pessoas por nível</p>
                    <ul className="mt-2 flex flex-col gap-1 text-sm">
                      {evolution.data.byLevel.length === 0 ? (
                        <li className="text-ink-faint">Ninguém ganhou XP ainda.</li>
                      ) : (
                        evolution.data.byLevel.map((row) => (
                          <li key={row.level} className="flex justify-between gap-3">
                            <span className="text-ink-muted">
                              Nível {row.level}, {levelSpecOf(row.level).name}
                            </span>
                            <span className="tabular text-ink">{formatValue(row.people)}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div className="rounded-card border border-line bg-surface p-4">
                    <p className="text-xs text-ink-faint">Conquistas alcançadas</p>
                    <ul className="mt-2 flex flex-col gap-1 text-sm">
                      {evolution.data.achievements.length === 0 ? (
                        <li className="text-ink-faint">Nenhuma ainda.</li>
                      ) : (
                        evolution.data.achievements.map((row) => (
                          <li key={row.key} className="flex justify-between gap-3">
                            <span className="text-ink-muted">{achievementName(row.key)}</span>
                            <span className="tabular text-ink">{formatValue(row.people)}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </>
            ) : (
              <QueryState loading={evolution.loading} error={evolution.error} onRetry={() => void evolution.reload()} />
            )}
          </Section>

          <Section title="Saúde do sistema" hint="Últimas 24 horas e disponibilidade dos últimos 7 dias.">
            <div className="flex flex-wrap gap-2">
              <StatusTag tone="positive">Banco: {data.health.database}</StatusTag>
              <StatusTag tone={data.health.ai_enabled ? 'positive' : 'warn'}>
                IA: {data.health.ai_enabled ? 'ligada' : 'desligada'}
              </StatusTag>
              <StatusTag tone={data.health.maintenance ? 'warn' : 'neutral'}>
                Manutenção: {data.health.maintenance ? 'ativa' : 'não'}
              </StatusTag>
              <StatusTag tone={data.health.critical_errors_24h > 0 ? 'danger' : 'neutral'}>
                Erros críticos 24h: {data.health.critical_errors_24h}
              </StatusTag>
            </div>
            <div className="mt-4">
            <MetricGrid cols={4}>
              <Metric label="Disponibilidade 7d" value={data.health.availability_7d} format="percent" hint="Horas sem erro crítico" />
              <Metric label="Erro da IA 24h" value={data.health.ai_error_rate_24h} format="percent" />
              <Metric label="Resposta média da IA" value={data.health.ai_avg_ms_24h} format="ms" />
              <Metric label="Erros 24h" value={data.totals.errors_24h} />
            </MetricGrid>
            </div>
          </Section>
        </>
      ) : null}
    </AdminPage>
  )
}

function achievementName(key: string): string {
  const known = ACHIEVEMENT_KEYS.find((candidate) => candidate === key)
  return known ? achievementSpec(known).name : key
}

function SeriesCard({ label, points }: { readonly label: string; readonly points: readonly number[] }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <Sparkline points={points} label={label} className="mt-2" />
    </div>
  )
}
