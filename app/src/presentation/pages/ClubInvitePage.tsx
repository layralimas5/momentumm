import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CLUB_CATEGORY_LABELS } from '@/domain/entities/club'
import type { ClubInvitePreview } from '@/domain/entities/club-invite'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { LogoMark } from '@/presentation/components/brand/Logo'
import { Button } from '@/presentation/components/ui/Button'
import { Panel } from '@/presentation/components/ui/Surface'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { ProfileBanner } from '@/presentation/profile/ProfileBanner'
import { toUserMessage } from '@/shared/errors'

/**
 * A tela do link do clube.
 *
 * PÚBLICA de propósito, como a do Juntos: quem recebe o link pode não ter
 * conta, e mandar essa pessoa pro login sem dizer do que se trata é perder o
 * convite. O que ela mostra antes do login é o mínimo, nome, descrição,
 * categoria e quantas pessoas, e quem decide isso é o servidor
 * (`club_invite_preview`), não esta tela. Nenhum nome de membro e nenhum
 * número de ninguém: quem tem o link ainda não é do clube.
 *
 * Sem sessão, o caminho de volta é o próprio link: o token está na URL.
 */
export function ClubInvitePage() {
  const { token = '' } = useParams()
  const { user, loading: loadingAuth } = useAuth()
  const navigate = useNavigate()

  const [preview, setPreview] = useState<ClubInvitePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let alive = true
    track('club_invite_link_opened', 'desafios', { result: user ? 'com_sessao' : 'sem_sessao' })

    void container.clubs
      .previewInvite(token)
      .then((next) => {
        if (alive) setPreview(next)
      })
      .catch((cause: unknown) => {
        if (alive) setError(toUserMessage(cause))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })

    return () => {
      alive = false
    }
  }, [token, user])

  const entrar = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const clubId = await container.clubs.joinByToken(token)
      track('club_joined', 'desafios', { result: 'link' })
      navigate(`/app/clubes/${clubId}`, { replace: true })
    } catch (cause) {
      setError(toUserMessage(cause))
      setBusy(false)
    }
  }, [token, navigate])

  if (loading || loadingAuth) {
    return (
      <Shell>
        <LoadingBlock label="Abrindo o convite" />
      </Shell>
    )
  }

  if (!preview || preview.status !== 'valido') {
    return (
      <Shell>
        <Panel className="p-6 text-center">
          <h1 className="text-xl font-semibold text-ink">
            {preview?.status === 'arquivado' ? 'Esse clube foi arquivado' : 'Convite não encontrado'}
          </h1>
          <p className="mt-2 text-sm text-pretty text-ink-muted">
            {preview?.status === 'arquivado'
              ? 'Ele não recebe gente nova. Quem já estava dentro continua com o histórico.'
              : 'Confere se o link veio inteiro. Se não, peça outro pra quem te chamou.'}
          </p>
          <Button className="mt-5" variant="secondary" onClick={() => navigate('/')}>
            Conhecer o Momentumm
          </Button>
        </Panel>
      </Shell>
    )
  }

  return (
    <Shell>
      <Panel flush>
        <ProfileBanner banner={preview.cover ?? 'aurora'} className="h-28" />

        <div className="p-6">
          <p className="text-sm text-ink-muted">Convite pro clube</p>
          <h1 className="mt-1 text-xl leading-tight font-semibold tracking-tight text-balance text-ink">
            {preview.name}
          </h1>

          <p className="mt-2 text-sm text-ink-faint">
            {preview.category ? CLUB_CATEGORY_LABELS[preview.category] : 'Geral'}
            <span aria-hidden="true"> · </span>
            <span className="tabular">
              {preview.members} {preview.members === 1 ? 'pessoa' : 'pessoas'}
            </span>
          </p>

          {preview.description ? (
            <p className="mt-3 text-sm text-pretty text-ink-muted">{preview.description}</p>
          ) : null}

          <ul className="mt-4 flex flex-col gap-1.5 text-sm text-ink-muted">
            <li>· O clube vê os dias que você cumpriu nos desafios daqui, e nada além.</li>
            <li>· Hábito, ação e registro continuam sendo só seus.</li>
            <li>· Dá pra sair quando quiser, sem pedir pra ninguém.</li>
          </ul>

          {preview.alreadyMember ? (
            <Button
              size="lg"
              className="mt-6"
              onClick={() => navigate(`/app/clubes/${preview.clubId}`)}
            >
              Você já está dentro. Abrir o clube
            </Button>
          ) : user ? (
            <Button size="lg" className="mt-6" loading={busy} onClick={() => void entrar()}>
              Entrar no clube
            </Button>
          ) : (
            <div className="mt-6">
              <Button
                size="lg"
                onClick={() => navigate('/entrar', { state: { from: `/clube/${token}` } })}
              >
                Entrar pra participar
              </Button>
              <p className="mt-2 text-xs text-ink-faint">
                Ainda não tem conta? Dá pra criar em um minuto: o link continua valendo.
              </p>
            </div>
          )}

          <div aria-live="polite" className="min-h-6">
            {error ? <ErrorNote message={error} /> : null}
          </div>
        </div>
      </Panel>
    </Shell>
  )
}

function Shell({ children }: { readonly children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <LogoMark className="size-10" />
        </div>
        {children}
      </div>
    </main>
  )
}
