import { Button } from '@/presentation/components/ui/Button'
import { useInstallApp } from './use-install-app'

/**
 * O convite pra instalar, em Configurações.
 *
 * Só aparece pra quem ainda está no navegador. Instalado, o Momentumm abre
 * direto no Hoje, aceita o lembrete diário e some a barra do navegador, então
 * o bloco explica o ganho em vez de só mandar instalar.
 */
export function InstallAppSettings() {
  const install = useInstallApp()

  if (install.kind === 'installed' || install.kind === 'unavailable') return null

  return (
    <div className="border-t border-line pt-4">
      <p className="text-sm font-medium text-ink">Instalar o app</p>
      <p className="mt-2 text-sm text-ink-muted">
        {install.kind === 'manual-ios'
          ? 'No iPhone: toca em Compartilhar, depois em "Adicionar à Tela de Início". Aí o Momentumm abre direto no Hoje, com ícone próprio e sem a barra do navegador.'
          : 'O Momentumm ganha ícone próprio e abre direto no Hoje, sem passar pela página de apresentação.'}
      </p>

      {install.kind === 'promptable' ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          onClick={() => void install.install()}
        >
          Instalar o app
        </Button>
      ) : null}
    </div>
  )
}
