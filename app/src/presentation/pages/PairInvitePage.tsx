import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { InvitePreview } from '@/domain/entities/pair'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { LogoMark } from '@/presentation/components/brand/Logo'
import { Button } from '@/presentation/components/ui/Button'
import { Panel } from '@/presentation/components/ui/Surface'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { toUserMessage } from '@/shared/errors'

/**
 * A tela do link de convite.
 *
 * Ela é PÚBLICA de propósito: quem recebe o link pode não ter conta, e mandar
 * essa pessoa pro login sem dizer do que se trata é perder a maior parte dos
 * convites. O que ela mostra antes do login é o mínimo — primeiro nome e
 * avatar de quem convidou — e quem decide isso é o servidor
 * (`pair_invite_preview`), não esta tela.
 *
 * Quem não tem sessão entra pelo fluxo normal e volta pra cá: o token fica na
 * URL, então o caminho de volta é o próprio link.
 */
export function PairInvitePage() {
  const { token = '' } = useParams()
  const { user, loading: loadingAuth } = useAuth()
  const navigate = useNavigate()

  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let alive = true
    track('pair_invite_opened', 'juntos', { result: user ? 'com_sessao' : 'sem_sessao' })

    void container.pairs
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

  const accept = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await container.pairs.acceptInvite(token)
      track('pair_invite_accepted', 'juntos')
      track('pair_created', 'juntos')
      navigate('/app/juntos', { replace: true })
    } catch (cause) {
      setError(toUserMessage(cause))
    } finally {
      setBusy(false)
    }
  }, [token, navigate])

  const decline = useCallback(async () => {
    setBusy(true)
    try {
      await container.pairs.declineInvite(token)
      navigate('/', { replace: true })
    } catch (cause) {
      setError(toUserMessage(cause))
      setBusy(false)
    }
  }, [token, navigate])

  if (loading || loadingAuth) return <Shell><LoadingBlock label="Abrindo o convite" /></Shell>

  const invalido = !preview || preview.status !== 'pendente'

  if (invalido) {
    return (
      <Shell>
        <Panel className="p-6 text-center">
          <h1 className="text-xl font-semibold text-ink">{tituloDoEstado(preview?.status)}</h1>
          <p className="mt-2 text-sm text-pretty text-ink-muted">{notaDoEstado(preview?.status)}</p>
          <Button className="mt-5" variant="secondary" onClick={() => navigate('/')}>
            Conhecer o Momentumm
          </Button>
        </Panel>
      </Shell>
    )
  }

  return (
    <Shell>
      <Panel tone="brand" className="p-6">
        <div className="flex items-center gap-3">
          <Avatar name={preview.inviterName ?? 'Alguém'} src={preview.inviterAvatar} className="size-12" />
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Convite de</p>
            <p className="truncate text-lg font-semibold text-ink">
              {preview.inviterName ?? 'Alguém'}
            </p>
          </div>
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-tight text-balance text-ink">
          Vamos avançar juntas?
        </h1>
        <p className="mt-2 text-sm text-pretty text-ink-muted">
          Vocês não precisam ter o mesmo objetivo. O combinado é continuar avançando — e cada uma vê
          apenas se a outra avançou no dia.
        </p>

        <ul className="mt-4 flex flex-col gap-1.5 text-sm text-ink-muted">
          <li>· Ninguém vê os objetivos, as ações ou as notas da outra.</li>
          <li>· Dá pra desfazer a dupla a qualquer momento.</li>
          <li>· Não existe feed, ranking nem comentário.</li>
        </ul>

        {user ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button size="lg" loading={busy} onClick={() => void accept()}>
              Aceitar convite
            </Button>
            <Button size="lg" variant="ghost" disabled={busy} onClick={() => void decline()}>
              Agora não
            </Button>
          </div>
        ) : (
          <div className="mt-6">
            <Button
              size="lg"
              onClick={() => navigate('/entrar', { state: { from: `/juntos/${token}` } })}
            >
              Entrar pra aceitar
            </Button>
            <p className="mt-2 text-xs text-ink-faint">
              Ainda não tem conta? Dá pra criar em um minuto — o convite continua valendo.
            </p>
          </div>
        )}

        <div aria-live="polite" className="min-h-6">
          {error ? <ErrorNote message={error} /> : null}
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

function tituloDoEstado(status: InvitePreview['status'] | undefined): string {
  if (status === 'aceito') return 'Esse convite já foi usado'
  if (status === 'expirado') return 'Esse convite venceu'
  if (status === 'cancelado') return 'Esse convite foi cancelado'
  if (status === 'recusado') return 'Esse convite foi recusado'
  return 'Convite não encontrado'
}

function notaDoEstado(status: InvitePreview['status'] | undefined): string {
  if (status === 'aceito') return 'Cada link vale uma vez só. Peça um novo pra quem te convidou.'
  if (status === 'expirado') return 'Os links valem sete dias. Peça um novo pra quem te convidou.'
  return 'Confere se o link veio inteiro. Se não, peça outro pra quem te convidou.'
}
