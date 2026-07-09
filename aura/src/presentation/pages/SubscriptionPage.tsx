import { Link, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { AuraMark } from '@/presentation/components/AuraMark'
import { Button } from '@/presentation/components/ui/Button'
import { CtaLink } from '@/presentation/components/landing/CtaLink'
import { SUBSCRIPTION_STATUS_LABEL } from '@/domain/entities/profile'
import { useAuth } from '@/presentation/auth/use-auth'

/** Mostrada quando a pessoa está logada mas sem assinatura ativa. */
export function SubscriptionPage() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const status = profile?.subscriptionStatus

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-50 px-5 py-12 text-center dark:bg-zinc-950">
      <Link to="/" className="mb-8" aria-label="Aura — início">
        <AuraMark />
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
          <Lock className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Sua assinatura não está ativa
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          {status === 'canceled'
            ? 'Sua assinatura foi cancelada. Reative pra voltar à sua jornada.'
            : 'Garanta seu acesso pra desbloquear metas, leituras e todo o seu painel.'}
          {status && (
            <>
              {' '}
              <span className="text-zinc-400">
                (status: {SUBSCRIPTION_STATUS_LABEL[status].toLowerCase()})
              </span>
            </>
          )}
        </p>

        <CtaLink className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-lg bg-brand-600 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-500">
          Garantir meu acesso
        </CtaLink>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-4 text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Sair
        </button>
      </div>

      <Button variant="ghost" className="mt-6" onClick={() => navigate('/')}>
        Voltar ao início
      </Button>
    </div>
  )
}
