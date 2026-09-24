import { useEffect } from 'react'
import { track } from '@/infrastructure/analytics/track'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Button } from '@/presentation/components/ui/Button'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'

/**
 * Os três toques que instalam o Momentumm no iPhone.
 *
 * O iOS não tem prompt de instalação: quem decide é a pessoa, no menu do
 * Safari, e o app só pode mostrar o caminho. Por isso o sheet é curto e
 * literal — o nome de cada item é o nome que está na tela do aparelho, na
 * ordem em que aparece. Nada de "siga as instruções do seu navegador".
 */

interface Passo {
  readonly icon: IconName
  readonly titulo: string
  readonly detalhe: string
}

const PASSOS: readonly Passo[] = [
  {
    icon: 'compartilhar',
    titulo: 'Toque em Compartilhar',
    detalhe: 'O quadrado com a seta pra cima, na barra do Safari.',
  },
  {
    icon: 'maisQuadrado',
    titulo: 'Escolha "Adicionar à Tela de Início"',
    detalhe: 'Role a lista um pouco pra baixo se não estiver à vista.',
  },
  {
    icon: 'check',
    titulo: 'Confirme em "Adicionar"',
    detalhe: 'O Momentumm vira um ícone na sua tela, como qualquer outro app.',
  },
]

export function IosInstallSheet({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) {
  useEffect(() => {
    if (open) track('ios_install_shown')
  }, [open])

  return (
    <BottomSheet
      open={open}
      title="Instalar no iPhone"
      description="Três toques. Depois o Momentumm abre direto da sua tela, e as notificações passam a funcionar."
      onClose={onClose}
      footer={
        <Button className="w-full" onClick={onClose}>
          Entendi
        </Button>
      }
    >
      <ol className="flex flex-col gap-3">
        {PASSOS.map((passo, index) => (
          <li key={passo.titulo} className="flex items-start gap-3.5">
            <span
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-brand/40 bg-brand-dim/50 text-brand-hi"
            >
              <Icon name={passo.icon} />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-sm font-medium text-ink">
                {index + 1}. {passo.titulo}
              </span>
              <span className="mt-0.5 block text-sm text-ink-faint">{passo.detalhe}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-sm text-ink-faint">
        No iPhone, notificação só existe com o app na tela de início. É uma regra da Apple, não
        uma escolha nossa.
      </p>
    </BottomSheet>
  )
}
