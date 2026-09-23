import { useCallback, useState } from 'react'
import type { PairInvite } from '@/domain/entities/pair'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { toUserMessage } from '@/shared/errors'

/** O caminho do convite. Mora aqui porque a rota e o link precisam concordar. */
export const INVITE_PATH = '/juntos'

export function inviteUrl(token: string): string {
  return `${window.location.origin}${INVITE_PATH}/${token}`
}

/**
 * Convidar alguém.
 *
 * O convite é um LINK, não uma busca por nome: sem descoberta, ninguém entra
 * numa dupla sem ter recebido o endereço de quem convidou. É o que dispensa
 * bloqueio, denúncia e "quem pode me convidar" — o MVP não tem nada disso
 * porque não precisa ter.
 *
 * O token aparece uma vez. Gerar outro cancela o anterior no servidor, e o
 * texto diz isso antes de a pessoa clicar.
 */
export function InvitePanel({ onInvited }: { readonly onInvited?: () => void }) {
  const [invite, setInvite] = useState<PairInvite | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const next = await container.pairs.createInvite()
      setInvite(next)
      track('pair_invite_created', 'juntos')
      onInvited?.()
    } catch (cause) {
      setError(toUserMessage(cause))
    } finally {
      setBusy(false)
    }
  }, [onInvited])

  const share = useCallback(async () => {
    if (!invite) return
    const url = inviteUrl(invite.token)

    /*
      No celular o menu nativo é o caminho: é dele que saem WhatsApp e
      mensagem, que é como um convite desses realmente viaja. Sem suporte,
      copiar resolve.
    */
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Vamos avançar juntos no Momentumm?',
          text: 'Criei uma dupla no Momentumm. A gente só vê se o outro avançou no dia — nada além disso.',
          url,
        })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2400)
    } catch {
      // Compartilhamento cancelado pela pessoa não é erro.
    }
  }, [invite])

  return (
    <Panel tone="brand" className="p-5">
      <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-ink uppercase">
        <Icon name="mais" className="size-4" />
        Convidar alguém
      </p>

      <h2 className="mt-3 text-lg font-semibold tracking-tight text-balance text-ink">
        Uma pessoa, um compromisso: continuar avançando.
      </h2>

      <p className="mt-2 text-sm text-pretty text-ink-muted">
        Vocês não precisam ter o mesmo objetivo. A outra pessoa vê apenas se você avançou no dia —
        nunca o que você está fazendo, nem os seus objetivos, notas ou registros.
      </p>

      {invite ? (
        <div className="mt-4">
          <label className="text-xs font-medium tracking-wide text-ink-faint uppercase" htmlFor="link-convite">
            Seu link
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <input
              id="link-convite"
              readOnly
              value={inviteUrl(invite.token)}
              onFocus={(event) => event.currentTarget.select()}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 text-sm text-ink-muted"
            />
            <Button onClick={() => void share()} className="shrink-0">
              <Icon name="mais" className="size-4" />
              {copied ? 'Link copiado' : 'Compartilhar'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Vale por 7 dias e só pode ser usado uma vez. Gerar outro link cancela este.
          </p>
          <button
            type="button"
            onClick={() => void create()}
            className="mt-2 text-sm font-medium text-brand-hi underline-offset-2 hover:underline"
          >
            Gerar outro link
          </button>
        </div>
      ) : (
        <Button size="lg" className="mt-5" loading={busy} onClick={() => void create()}>
          Criar link de convite
        </Button>
      )}

      <div aria-live="polite" className="min-h-6">
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      </div>
    </Panel>
  )
}
