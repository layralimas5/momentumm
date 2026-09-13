import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ACTIVITY_VISIBILITIES, VISIBILITY_LABELS, type ActivityVisibility } from '@/domain/entities/activity'
import { formatLimit, isPro, limitsOf, PLAN_LABELS, type PlanTier } from '@/domain/entities/plan'
import { MAX_REST_WEEKDAYS } from '@/domain/entities/momentum'
import {
  initialsOf,
  normalizeHandle,
  MAX_BIO_LENGTH,
  WEEKDAY_LABELS,
} from '@/domain/entities/profile'
import { container } from '@/infrastructure/container'
import { demoStore } from '@/infrastructure/demo/demo-store'
import { useAuth } from '@/presentation/auth/use-auth'
import { Button } from '@/presentation/components/ui/Button'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { MobileShortcuts } from '@/presentation/components/mobile/MobileShortcuts'
import { CancellationBlock } from '@/presentation/profile/CancellationBlock'
import { SecurityPanel } from '@/presentation/profile/SecurityPanel'
import { SupportPanel } from '@/presentation/profile/SupportPanel'
import { usePlanner } from '@/presentation/planner/use-planner'
import { cn } from '@/shared/lib/cn'

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
  const [restWeekdays, setRestWeekdays] = useState<readonly number[]>(
    profile?.restWeekdays ?? [],
  )
  const [saved, setSaved] = useState(false)

  const toggleRestDay = (day: number) => {
    setRestWeekdays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : current.length >= MAX_REST_WEEKDAYS
          ? current
          : [...current, day].sort((a, b) => a - b),
    )
  }

  const save = useAsyncAction(async () => {
    if (!user) return
    await container.profiles.update(user.id, {
      name,
      handle,
      bio: bio.trim() || null,
      defaultVisibility: visibility,
      restWeekdays,
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

      <MobileShortcuts />

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

          {/*
            Descanso planejado é escolha, não falta: o Momentum tira da conta
            o dia vazio que a pessoa marcou aqui. Dois por semana no máximo,
            e o limite aparece antes da tentativa, não como erro depois.
          */}
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-ink">Dias de descanso</legend>
            <p className="text-xs text-pretty text-ink-muted">
              Até {MAX_REST_WEEKDAYS} por semana. Um dia de descanso vazio não conta contra o
              teu Momentum; se você se mover nele, ele conta normal.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, day) => {
                const active = restWeekdays.includes(day)
                const full = !active && restWeekdays.length >= MAX_REST_WEEKDAYS
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={active}
                    disabled={full}
                    onClick={() => toggleRestDay(day)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      active
                        ? 'border-brand/40 bg-brand-dim/50 text-brand-ink'
                        : 'border-line text-ink-muted hover:bg-surface-hi',
                      full ? 'cursor-not-allowed opacity-50' : '',
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </fieldset>

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
              <li>Objetivos ativos: {formatLimit(limits.activeObjectives)}</li>
              <li>Hábitos ativos: {formatLimit(limits.activeHabits)}</li>
              <li>Planos ativos: {formatLimit(limits.activePlans)}</li>
              <li>Ações por dia: {formatLimit(limits.actionsPerDay)}</li>
              <li>
                Histórico:{' '}
                {Number.isFinite(limits.historyDays) ? `últimos ${limits.historyDays} dias` : 'completo'}
              </li>
              <li>Momentum Score: {limits.momentumDetail ? 'evolução e detalhamento' : 'pontuação de hoje'}</li>
              <li>Review semanal: {limits.fullReview ? 'completo' : 'check-in manual'}</li>
              <li>Momentumm AI: {limits.ai ? 'franquia mensal' : 'não disponível'}</li>
            </ul>

            {isPro(profile.plan) && !container.demo ? <CancellationBlock /> : null}

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

      {/*
        Segurança vem depois do perfil e ocupa a largura inteira: senha,
        segundo fator, sessões e exclusão são decisões de peso diferente das
        de nome e @, e espremê-las na coluna lateral as faria parecer
        preferências.
      */}
      <SecurityPanel />

      {/*
        O canal com a equipe fica por último: é o que menos se usa, e o que
        precisa existir quando se usa. Os pedidos de acesso ao conteúdo, quando
        houver, sobem pro topo do bloco sozinhos.
      */}
      <SupportPanel />
    </div>
  )
}
