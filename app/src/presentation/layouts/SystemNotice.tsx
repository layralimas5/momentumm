import { useEffect, useState } from 'react'
import type { PublicSettings } from '@/domain/admin/admin-schemas'
import { container } from '@/infrastructure/container'
import { cn } from '@/shared/lib/cn'

/**
 * O que o owner publica pra todo mundo: manutenção e a mensagem geral.
 *
 * Lê `public_settings()`, que devolve só as chaves marcadas como públicas.
 * Sem Supabase (demo) não há o que ler. Falha de leitura não mostra nada:
 * um aviso que aparece por engano é pior que um que atrasa um minuto.
 */
export function SystemNotice() {
  const [settings, setSettings] = useState<PublicSettings | null>(null)

  useEffect(() => {
    if (container.demo) return
    void container.support
      .publicSettings()
      .then(setSettings)
      .catch(() => setSettings(null))
  }, [])

  const maintenance = settings?.maintenance
  const message = settings?.['system.message']

  if (maintenance?.enabled) {
    return (
      <div role="status" className="border-b border-flame/30 bg-flame-dim/40 px-4 py-2 text-center text-sm text-ink">
        <strong>Manutenção em andamento.</strong>{' '}
        {maintenance.message || 'Algumas funções podem falhar por alguns minutos.'}
      </div>
    )
  }

  if (message?.enabled && message.text) {
    return (
      <div
        role="status"
        className={cn(
          'border-b px-4 py-2 text-center text-sm text-ink',
          message.tone === 'aviso' && 'border-flame/30 bg-flame-dim/40',
          message.tone === 'sucesso' && 'border-positive/30 bg-positive/10',
          message.tone === 'info' && 'border-brand/30 bg-brand-dim/40',
        )}
      >
        {message.text}
      </div>
    )
  }

  return null
}
