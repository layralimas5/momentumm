import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  effectiveLegalVersions,
  formatLegalVersion,
  LEGAL_LABELS,
  LEGAL_PATHS,
  LEGAL_VERSIONS,
  pendingLegalDocuments,
  type LegalDocument,
  type LegalVersions,
} from '@/domain/legal/legal-documents'
import type { PublicSettings } from '@/domain/admin/admin-schemas'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { Button } from '@/presentation/components/ui/Button'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'

/**
 * O aceite dos Termos e da Política, registrado por versão.
 *
 * O cadastro já pede o "li e aceito", mas o registro só pode existir com
 * sessão — e no cadastro por e-mail a sessão nasce depois da confirmação. Por
 * isso o aceite é gravado AQUI, na primeira entrada no app, e de novo sempre
 * que a versão vigente mudar: a linha que falta em `legal_acceptances` é o
 * que abre o diálogo. Não dá pra fechar sem aceitar; dá pra ler antes.
 */
export function LegalGate() {
  const { user, signOut } = useAuth()
  const [pending, setPending] = useState<readonly LegalDocument[]>([])
  const [versions, setVersions] = useState<LegalVersions>(LEGAL_VERSIONS)
  const [checked, setChecked] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    try {
      // A versão publicada pelo painel pode ser mais nova que a do build.
      const published: PublicSettings = await container.support.publicSettings().catch(() => ({}))
      const current = effectiveLegalVersions(published['legal.versions'])
      setVersions(current)
      setPending(pendingLegalDocuments(await container.legal.listMine(user.id), current))
    } catch {
      // Sem leitura não há como saber: melhor não bloquear o app por uma
      // falha de rede. O aceite volta a ser pedido na próxima carga.
      setPending([])
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const accept = useAsyncAction(async () => {
    if (!user) return
    await container.legal.accept(user.id, pending, versions)
    setPending([])
  })

  if (!user || pending.length === 0) return null

  return (
    <Dialog
      open
      title="Antes de continuar"
      description="Pra usar o Momentumm você precisa aceitar os documentos abaixo. Fechar sem aceitar encerra a sessão."
      onClose={() => void signOut()}
    >
      <ul className="flex flex-col gap-2">
        {pending.map((document) => (
          <li key={document} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-2.5 text-sm">
            <span className="text-ink">
              {LEGAL_LABELS[document]}
              <span className="ml-2 text-xs text-ink-faint">versão de {formatLegalVersion(versions[document])}</span>
            </span>
            <Link to={LEGAL_PATHS[document]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-hi hover:underline">
              Ler
              <Icon name="seta" className="size-3.5" />
            </Link>
          </li>
        ))}
      </ul>

      <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm text-ink-muted">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-[var(--color-brand)]"
        />
        Li e aceito. O aceite fica registrado com a versão e a data.
      </label>

      <div aria-live="polite" className="min-h-5">
        {accept.error ? <p className="mt-1 text-sm text-danger">{accept.error}</p> : null}
      </div>

      <Button className="mt-2 w-full" disabled={!checked} loading={accept.running} onClick={() => void accept.run()}>
        Aceitar e continuar
      </Button>
    </Dialog>
  )
}
