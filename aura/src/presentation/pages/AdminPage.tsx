import { Link, useNavigate } from 'react-router-dom'
import { Users, TrendingUp, Clock, DollarSign, ExternalLink, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  SUBSCRIPTION_STATUS_LABEL,
  type Profile,
  type SubscriptionStatus,
} from '@/domain/entities/profile'
import { AuraMark } from '@/presentation/components/AuraMark'
import { Card } from '@/presentation/components/ui/Card'
import { Badge } from '@/presentation/components/ui/Badge'
import { Button } from '@/presentation/components/ui/Button'
import { useAuth } from '@/presentation/auth/use-auth'
import { useAdminProfiles } from '@/presentation/hooks/use-admin-profiles'

const statusTone: Record<SubscriptionStatus, 'success' | 'brand' | 'neutral'> = {
  active: 'success',
  pending: 'brand',
  canceled: 'neutral',
  blocked: 'neutral',
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function AdminPage() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const { profiles, metrics, loading, error, setStatus } = useAdminProfiles()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-svh bg-zinc-50 dark:bg-zinc-950">
      {/* Top bar */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <AuraMark />
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Link to="/app">
              <Button variant="ghost" size="sm">
                Ver o app
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Painel
        </h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">Contas, assinaturas e métricas do Aura.</p>

        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {/* Métricas */}
        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Users} label="Total de contas" value={metrics?.total} loading={loading} />
          <Metric icon={TrendingUp} label="Assinantes ativas" value={metrics?.active} loading={loading} />
          <Metric icon={Clock} label="Pendentes" value={metrics?.pending} loading={loading} />
          <Metric
            icon={DollarSign}
            label="MRR estimado"
            value={metrics ? brl(metrics.estimatedMrr) : undefined}
            loading={loading}
          />
        </section>

        {/* Tabela de contas */}
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Contas</h2>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
                  <tr>
                    <th className="px-5 py-3 font-medium">Conta</th>
                    <th className="px-5 py-3 font-medium">Plano</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Entrou em</th>
                    <th className="px-5 py-3 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                        Carregando...
                      </td>
                    </tr>
                  ) : profiles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-zinc-500">
                        Nenhuma conta ainda.
                      </td>
                    </tr>
                  ) : (
                    profiles.map((p) => <Row key={p.id} profile={p} onSetStatus={setStatus} />)
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </main>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: LucideIcon
  label: string
  value: number | string | undefined
  loading: boolean
}) {
  return (
    <Card className="p-5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {loading || value === undefined ? '—' : value}
      </p>
    </Card>
  )
}

function Row({
  profile,
  onSetStatus,
}: {
  profile: Profile
  onSetStatus: (id: string, status: SubscriptionStatus) => Promise<void>
}) {
  const created = new Date(profile.createdAt).toLocaleDateString('pt-BR')
  const isActive = profile.subscriptionStatus === 'active'

  return (
    <tr className="text-zinc-700 dark:text-zinc-300">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-zinc-900 dark:text-zinc-50">
            {profile.email ?? '—'}
          </span>
          {profile.role === 'admin' && (
            <Badge tone="brand" className="shrink-0">
              admin
            </Badge>
          )}
        </div>
      </td>
      <td className="px-5 py-3.5 capitalize">{profile.plan ?? '—'}</td>
      <td className="px-5 py-3.5">
        <Badge tone={statusTone[profile.subscriptionStatus]}>
          {SUBSCRIPTION_STATUS_LABEL[profile.subscriptionStatus]}
        </Badge>
      </td>
      <td className="px-5 py-3.5 text-zinc-500">{created}</td>
      <td className="px-5 py-3.5">
        <div className="flex justify-end gap-2">
          {isActive ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSetStatus(profile.id, 'blocked')}
              disabled={profile.role === 'admin'}
            >
              Bloquear
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => onSetStatus(profile.id, 'active')}>
              Liberar
            </Button>
          )}
        </div>
      </td>
    </tr>
  )
}
