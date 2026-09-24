import { useCallback, useState } from 'react'
import type { PairInvite } from '@/domain/entities/pair'
import { track } from '@/infrastructure/analytics/track'
import { container } from '@/infrastructure/container'
import { SITE } from '@/presentation/components/landing/site'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { toUserMessage } from '@/shared/errors'

/** O caminho do convite. Mora aqui porque a rota e o link precisam concordar. */
export const INVITE_PATH = '/juntos'

/**
 * O endereço do convite: sempre `momentumm.com.br/juntos/<código>`.
 *
 * O domínio vem de `SITE.url` e NÃO de `window.location.origin`. Com a origem
 * da janela, um convite criado em `localhost:5176` saía
 * `http://localhost:5176/juntos/...`, que é um link que só abre na máquina de
 * quem gerou — e é justamente em desenvolvimento que a gente testa mandar o
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
 * bloqueio, denúncia e "quem pode me convidar" — o MVP não tem nada disso
 * porque não precisa ter.
 *
 * O token aparece uma vez, e o texto diz isso. Gerar outro NÃO cancela o
 * anterior desde a 0053: com mais de uma dupla possível, dois links vivos são
 * dois amigos diferentes sendo chamados, e matar o primeiro quebraria um
 * convite que já foi enviado. O que segura abuso é o teto de seis convites por
 * dia, e o teto de duplas do plano na hora do aceite.
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
    <Panel tone="brand" className="p-5">
      <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-ink uppercase">
        <Icon name="mais" className="size-4" />
        Convidar alguém
      </p>

      <h2 className="mt-3 text-lg font-semibold tracking-tight text-balance text-ink">
        Uma pessoa, um compromisso: continuar avançando.
      </h2>

      <p className="mt-2 text-sm text-pretty text-ink-muted">
        Vocês não precisam ter o mesmo objetivo. A outra pessoa vê apenas se você avançou no dia:
        nunca o que você está fazendo, nem os seus objetivos, notas ou registros. Cada dupla é
        separada: quem está numa não vê a outra.
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
            Vale por 7 dias e só pode ser usado uma vez. Os links que você já enviou continuam
            valendo.
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
