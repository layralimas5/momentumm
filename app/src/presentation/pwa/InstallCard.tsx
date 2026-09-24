import { useState } from 'react'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { IosInstallSheet } from './IosInstallSheet'
import { useInstallApp } from './use-install-app'

/**
 * O convite pra instalar o Momentumm no celular, no Hoje.
 *
 * Só aparece quando existe instalação possível de verdade: Android com o
 * convite guardado, ou iPhone fora da tela de início. Quem já está com o app
 * instalado, quem fechou o convite e quem usa um navegador que não instala
 * não veem nada — oferecer o que não existe é a forma mais rápida de a pessoa
 * parar de acreditar no que o app diz.
 *
 * A promessa é a mesma dos dois lados, e ela é o motivo real de instalar:
 * abrir direto, sem barra de navegador, e receber o lembrete do próximo passo.
 */
export function InstallCard() {
  const install = useInstallApp()
  const [sheetOpen, setSheetOpen] = useState(false)

  if (!install.shouldOffer) return null

  const noIphone = install.path === 'ios'

  return (
    <>
      <Panel
        tone="brand"
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-ink uppercase">
            <Icon name="celular" className="size-4" />
            Momentumm no celular
          </p>
          <p className="mt-2 text-base font-semibold text-balance text-ink">
            {noIphone
              ? 'Instale o Momentumm no seu iPhone.'
              : 'Instale o Momentumm no seu celular.'}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Abre direto, em tela cheia, e é o que permite receber o lembrete do próximo passo.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={install.dismiss}>
            Agora não
          </Button>
          <Button
            className="min-h-12"
            loading={install.busy}
            onClick={() => (noIphone ? setSheetOpen(true) : void install.install())}
          >
            {noIphone ? 'Como instalar' : 'Instalar'}
          </Button>
        </div>
      </Panel>

      <IosInstallSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  )
}
