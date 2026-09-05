import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ACTIVITY_VISIBILITIES, VISIBILITY_LABELS, type ActivityVisibility } from '@/domain/entities/activity'
import { formatLimit, isPro, limitsOf, PLAN_LABELS, type PlanTier } from '@/domain/entities/plan'
import { initialsOf, normalizeHandle, MAX_BIO_LENGTH } from '@/domain/entities/profile'
import { container } from '@/infrastructure/container'
import { demoStore } from '@/infrastructure/demo/demo-store'
import { useAuth } from '@/presentation/auth/use-auth'
import { Button } from '@/presentation/components/ui/Button'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { Icon } from '@/presentation/components/ui/Icon'
import { APP_NAV } from '@/presentation/layouts/nav-items'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'

/**
 * As telas que não cabem na barra inferior do celular.
 *
 * A barra leva Hoje, Objetivos, Plano e Perfil. Todo o resto chega por aqui —
 * e é por isso que a lista se deriva da navegação em vez de ser escrita à mão:
 * tela nova aparece no atalho sem ninguém lembrar de vir aqui.
 */
const MOBILE_TAB_ROUTES = ['/app', '/app/objetivos', '/app/plano', '/app/configuracoes']
const MOBILE_SHORTCUTS = APP_NAV.filter((item) => !MOBILE_TAB_ROUTES.includes(item.to))

export function ProfilePage() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth()
  const planner = usePlanner()
  const navigate = useNavigate()

  const [name, setName] = useState(profile?.name ?? '')
  const [handle, setHandle] = useState(profile?.handle ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [visibility, setVisibility] = useState<ActivityVisibility>(
    profile?.defaultVisibility ?? 'publica',
  )
  const [saved, setSaved] = useState(false)

  const save = useAsyncAction(async () => {
    if (!user) return
    await container.profiles.update(user.id, {
      name,
      handle,
      bio: bio.trim() || null,
      defaultVisibility: visibility,
    })
    await refreshProfile()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  })

  /**
   * Trocar de plano só existe no modo demo: em produção quem manda no plano é a
   * assinatura, e o repositório do Supabase ignora esse campo de propósito.
   */
  /**
   * Zerar o modo demo. Sem isso não há como voltar pro onboarding depois da
   * primeira sessão, e o primeiro acesso é justamente a parte mais difícil de
   * conferir com os olhos.
   */
  const restart = useAsyncAction(async () => {
    demoStore.clear()
    await planner.reload()
    navigate('/app')
  })

  const switchPlan = useAsyncAction(async (plan: PlanTier) => {
    if (!user) return
    await container.profiles.update(user.id, { plan })
    await refreshProfile()
  })

  if (loading) return <LoadingBlock label="Carregando teu perfil" />

  if (!profile) {
    return <ErrorNote message="Não consegui carregar teu perfil. Recarrega a página." />
  }

  const limits = limitsOf(profile.plan)

  return (
    <div className="flex flex-col gap-5 lg:gap-6">
      <header className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-dim text-lg font-semibold text-brand-hi"
        >
          {initialsOf(profile.name)}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-2xl font-semibold tracking-tight text-ink lg:text-[1.75rem]">
            {profile.name}
          </h2>
          <p className="truncate text-sm text-ink-muted">@{profile.handle}</p>
        </div>
      </header>

      {/*
        A barra do celular tem cinco lugares e Hábitos, Metas e Insights não
        cabem lá. Sem estes atalhos, uma conta sem hábito nenhum não teria como
        chegar na tela de hábitos — o "Ver todos" do dashboard só existe quando
        já existe hábito.
      */}
      <nav aria-label="Outras telas" className="lg:hidden">
        <ul className="surface-card divide-y divide-line overflow-hidden">
          {MOBILE_SHORTCUTS.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="flex min-h-14 items-center gap-3.5 px-4 py-3 transition-colors active:bg-surface-hi"
              >
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-hi text-ink-muted"
                >
                  <Icon name={item.icon} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{item.label}</span>
                  <span className="mt-0.5 block truncate text-sm text-ink-faint">
                    {item.description}
                  </span>
                </span>
                <Icon name="seta" className="size-4 shrink-0 text-ink-faint" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Dados à esquerda, sessão à direita: no desktop o formulário sozinho deixaria metade da tela vazia. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6 2xl:grid-cols-[minmax(0,1fr)_24rem] 2xl:gap-8">
        <form
          className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5"
          onSubmit={(event) => {
            event.preventDefault()
            void save.run()
          }}
        >
          {save.error ? <ErrorNote message={save.error} /> : null}

          <Field label="Nome">
            {(id) => (
              <TextInput
                id={id}
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                maxLength={60}
              />
            )}
          </Field>

          <Field label="@" hint="É o teu endereço público no Momentumm.">
            {(id, describedBy) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                value={handle}
                onChange={(event) => setHandle(normalizeHandle(event.target.value))}
                autoComplete="username"
              />
            )}
          </Field>

          <Field label="Bio" hint={`${bio.length}/${MAX_BIO_LENGTH}`}>
            {(id, describedBy) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={MAX_BIO_LENGTH}
                placeholder="Em uma linha, o que você está construindo."
              />
            )}
          </Field>

          <Field
            label="Visibilidade padrão"
            hint="Vale para os próximos registros. Cada atividade pode ser diferente."
          >
            {(id, describedBy) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                value={visibility}
                onChange={(event) => setVisibility(event.target.value as ActivityVisibility)}
              >
                {ACTIVITY_VISIBILITIES.map((item) => (
                  <option key={item} value={item}>
                    {VISIBILITY_LABELS[item]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="flex items-center gap-3">
            <Button type="submit" loading={save.running}>
              Salvar
            </Button>
            <span aria-live="polite" className="text-sm text-positive">
              {saved ? 'Salvo.' : ''}
            </span>
          </div>
        </form>

        <aside className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 lg:sticky lg:top-8">
          <div>
            <p className="text-sm font-medium text-ink">Sessão</p>
            <p className="mt-1 truncate text-sm text-ink-muted">{user?.email}</p>
          </div>

          <dl className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-faint">Visibilidade padrão</dt>
              <dd className="text-ink">{VISIBILITY_LABELS[profile.defaultVisibility]}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink-faint">Endereço</dt>
              <dd className="truncate text-ink">@{profile.handle}</dd>
            </div>
          </dl>

          <div className="border-t border-line pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-ink">Plano</p>
              <span
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium',
                  isPro(profile.plan)
                    ? 'border-brand/40 bg-brand-dim/50 text-brand-ink'
                    : 'border-line text-ink-muted',
                )}
              >
                {PLAN_LABELS[profile.plan]}
              </span>
            </div>

            <ul className="mt-3 flex flex-col gap-1.5 text-xs text-ink-faint">
              <li>Metas ativas: {formatLimit(limits.activeGoals)}</li>
              <li>Hábitos ativos: {formatLimit(limits.activeHabits)}</li>
              <li>Sessões de foco: {limits.focusDurations.join(', ')} min</li>
              <li>Insights por vez: {formatLimit(limits.insightsPerDay)}</li>
            </ul>

            {isPro(profile.plan) ? null : (
              <Link
                to="/#pro"
                className="mt-3 inline-flex text-sm font-medium text-brand-hi underline-offset-2 hover:underline"
              >
                Ver o que muda no PRO
              </Link>
            )}

            {container.demo ? (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 w-full"
                loading={switchPlan.running}
                onClick={() => void switchPlan.run(isPro(profile.plan) ? 'free' : 'pro')}
              >
                {isPro(profile.plan) ? 'Voltar pro gratuito' : 'Simular o PRO'}
              </Button>
            ) : null}
          </div>

          <Button variant="danger" onClick={() => void signOut()} className="w-full">
            Sair
          </Button>

          {container.demo ? (
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={restart.running}
                onClick={() => void restart.run()}
              >
                Recomeçar do zero
              </Button>
              <p className="text-xs text-ink-faint">
                Modo demo: os dados ficam só nesse navegador e recomeçar apaga tudo, inclusive o
                objetivo. É o caminho pra rever o onboarding.
              </p>
              <div aria-live="polite">
                {restart.error ? <p className="text-xs text-danger">{restart.error}</p> : null}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
