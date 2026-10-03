import { useCallback, useState } from 'react'
import type { PairInvite } from '@/domain/entities/pair'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { SITE } from '@/presentation/components/landing/site'
import { Card } from '@/presentation/components/ds/Card'
import { PrimaryButton } from '@/presentation/components/ds/Controls'
import { Icon } from '@/presentation/components/ui/Icon'
import { toUserMessage } from '@/shared/errors'

/** O caminho do convite. Mora aqui porque a rota e o link precisam concordar. */
export const INVITE_PATH = '/juntos'

/**
 * O endereço do convite: sempre `momentumm.com.br/juntos/<código>`.
 *
 * O domínio vem de `SITE.url` e NÃO de `window.location.origin`. Com a origem
 * da janela, um convite criado em `localhost:5176` saía
 * `http://localhost:5176/juntos/...`, que é um link que só abre na máquina de
 * quem gerou, e é justamente em desenvolvimento que a gente testa mandar o
 * convite pra outra pessoa. O mesmo valeria pra qualquer deploy de branch: o
 * link tem que apontar pra casa do produto, não pra onde a aba estava aberta.
 *
 * ## O que é o código
 *
 * Não é o id nem o @ do perfil, e isso é deliberado. Um código derivado do
 * perfil seria permanente e adivinhável: quem descobrisse o teu @ entraria na
 * tua dupla pra sempre, e não haveria como revogar sem trocar o perfil. O que
 * vai na URL são 24 bytes aleatórios gerados pelo servidor
 * (`pair_create_invite`), e o banco guarda só o sha256 deles: vale 7 dias, é de
 * uso único, e dá pra parar de valer sem mexer em nada do perfil.
 */
export function inviteUrl(token: string): string {
  return `${SITE.url}${INVITE_PATH}/${token}`
}

/**
 * Convidar alguém.
 *
 * O convite é um LINK, não uma busca por nome: sem descoberta, ninguém entra
 * numa dupla sem ter recebido o endereço de quem convidou. É o que dispensa
 * bloqueio, denúncia e "quem pode me convidar", o MVP não tem nada disso
 * porque não precisa ter.
 *
 * O token aparece uma vez, e o texto diz isso. Gerar outro NÃO cancela o
 * anterior desde a 0053: com mais de uma dupla possível, dois links vivos são
 * dois amigos diferentes sendo chamados, e matar o primeiro quebraria um
 * convite que já foi enviado. O que segura abuso é o teto de seis convites por
 * dia, e o teto de duplas do plano na hora do aceite.
 */
export function InvitePanel({
  onInvited,
  compact = false,
}: {
  readonly onInvited?: () => void
  /** Quem já tem dupla vê só o convite de mais uma, sem a explicação. */
  readonly compact?: boolean
}) {
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
          text: 'Criei uma dupla no Momentumm. A gente só vê se o outro avançou no dia, nada além disso.',
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
    <Card tone={compact ? 'flat' : 'float'} aria-labelledby="convite-dupla">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex shrink-0 -space-x-3">
          <span className="grid size-11 place-items-center rounded-full bg-brand-dim text-brand-hi ring-2 ring-surface">
            <Icon name="pessoa" className="size-5" />
          </span>
          <span className="grid size-11 place-items-center rounded-full bg-gradient-to-b from-brand to-brand-hi text-white ring-2 ring-surface">
            <Icon name="mais" className="size-5" strokeWidth={2.5} />
          </span>
        </span>
        <div className="min-w-0">
          <h2 id="convite-dupla" className="text-base font-semibold tracking-tight text-ink">
            {compact ? 'Convidar mais alguém' : 'Uma pessoa, um compromisso'}
          </h2>
          <p className="text-sm text-ink-faint">
            {compact ? 'Cada dupla é separada das outras.' : 'Continuar avançando, cada um no seu objetivo.'}
          </p>
        </div>
      </div>

      {compact ? null : (
        <p className="mt-3 text-sm text-pretty text-ink-muted">
          Vocês não precisam ter o mesmo objetivo. A outra pessoa vê só se você avançou no dia, nunca o que
          você está fazendo.
        </p>
      )}

      {invite ? (
        <div className="mt-4">
          <label className="eyebrow text-[0.62rem] text-ink-faint" htmlFor="link-convite">
            Seu link
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="link-convite"
              readOnly
              value={inviteUrl(invite.token)}
              onFocus={(event) => event.currentTarget.select()}
              className="well h-11 min-w-0 flex-1 rounded-xl px-3 text-sm text-ink-muted"
            />
            <button
              type="button"
              onClick={() => void share()}
              className="press flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-semibold text-white"
            >
              <Icon name={copied ? 'check' : 'compartilhar'} className="size-4" />
              {copied ? 'Copiado' : 'Enviar'}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-faint">Vale por 7 dias e só pode ser usado uma vez.</p>
          <button
            type="button"
            onClick={() => void create()}
            className="mt-1 min-h-10 text-sm font-medium text-brand-hi underline-offset-2 hover:underline"
          >
            Gerar outro link
          </button>
        </div>
      ) : (
        <PrimaryButton className="mt-4" disabled={busy} onClick={() => void create()}>
          <Icon name="convidar" className="size-5" />
          {busy ? 'Criando o link…' : 'Criar link de convite'}
        </PrimaryButton>
      )}

      <div aria-live="polite">{error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}</div>
    </Card>
  )
}
