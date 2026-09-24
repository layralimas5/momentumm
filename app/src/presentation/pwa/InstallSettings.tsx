import { useState } from 'react'
import { Button } from '@/presentation/components/ui/Button'
import { cn } from '@/shared/lib/cn'
import { IosInstallSheet } from './IosInstallSheet'
import { useInstallApp } from './use-install-app'

/**
 * O app no celular, em Configurações.
 *
 * Diferente do convite do Hoje, este bloco existe mesmo depois de a pessoa
 * ter fechado o convite, e existe também pra quem JÁ instalou: ver "Instalado"
 * escrito é o que responde "será que isso aqui é o app ou o site?" — a
 * pergunta que aparece quando o lembrete não chega.
 */
export function InstallSettings() {
  const install = useInstallApp()
  const [sheetOpen, setSheetOpen] = useState(false)

  if (install.path === 'none') return null

  const instalado = install.path === 'installed'
  const noIphone = install.path === 'ios'

  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">Momentumm no celular</p>
        <span
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-medium',
            instalado
              ? 'border-brand/40 bg-brand-dim/50 text-brand-ink'
              : 'border-line text-ink-muted',
          )}
        >
          {instalado ? 'Instalado' : 'Não instalado'}
        </span>
      </div>

      <p className="mt-2 text-sm text-ink-muted">
        {instalado
          ? 'Você está usando o app instalado: é daqui que as notificações funcionam.'
          : noIphone
            ? 'No iPhone, adicionar à tela de início é o que libera as notificações. São três toques.'
            : 'Instalado, o Momentumm abre em tela cheia e consegue te avisar do próximo passo.'}
      </p>

      {instalado ? null : (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          loading={install.busy}
          onClick={() => (noIphone ? setSheetOpen(true) : void install.install())}
        >
          {noIphone ? 'Ver como instalar' : 'Instalar o app'}
        </Button>
      )}

      <IosInstallSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  )
}
