import { useNavigate } from 'react-router-dom'
import { BottomSheet, SheetAction } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { usePostComposer } from '@/presentation/social/PostComposerProvider'

/**
 * O que o "+" da barra cria.
 *
 * Cinco linhas, e a ordem é a frequência do gesto, não a hierarquia do
 * produto: publicar e registrar acontecem todo dia, ação é quase todo dia,
 * hábito e objetivo são decisões de vez em quando.
 *
 * ## Nada aqui é fluxo novo
 *
 * Quatro das cinco linhas abrem o que já existe: o registro rápido da Jornada,
 * e o `Composer`/`ObjectiveDialog` que o dashboard e as telas de hábito e
 * objetivo já usam. Se esta folha tivesse formulários próprios, existiriam
 * dois jeitos de criar um hábito, e eles divergiriam na primeira regra nova.
 *
 * A única porta nova é "Publicar momento", que é o que a camada social
 * acrescentou.
 *
 * Esta folha substituiu o "+" flutuante e contextual (`AddFab`), que aparecia
 * só em Hoje e na Rotina e oferecia listas diferentes em cada uma. Com o botão
 * fixo no meio da barra, "criar" passou a ser um gesto com um lugar só, e o
 * que ele cria deixou de depender de onde a pessoa estava.
 */
export function CreateSheet({
  open,
  onClose,
}: {
  readonly open: boolean
  readonly onClose: () => void
}) {
  const composer = useComposer()
  const post = usePostComposer()
  const navigate = useNavigate()

  const pick = (kind: 'acao' | 'habito' | 'objetivo') => {
    onClose()
    composer.open(kind)
  }

  return (
    <BottomSheet
      open={open}
      title="Criar"
      description="O que você quer registrar agora?"
      onClose={onClose}
    >
      <div className="flex flex-col gap-1">
        <SheetAction
          icon={<Icon name="imagem" className="size-5" />}
          label="Publicar momento"
          hint="Uma foto do que você fez hoje"
          tone="brand"
          onClick={() => {
            onClose()
            post.open()
          }}
        />
        <SheetAction
          icon={<Icon name="progresso" className="size-5" />}
          label="Registrar progresso"
          hint="Minutos, páginas, o que você mediu"
          onClick={() => {
            onClose()
            navigate('/app/jornada')
          }}
        />
        <SheetAction
          icon={<Icon name="jornada" className="size-5" />}
          label="Nova ação"
          hint="Uma coisa concreta pra fazer"
          onClick={() => pick('acao')}
        />
        <SheetAction
          icon={<Icon name="habitos" className="size-5" />}
          label="Novo hábito"
          hint="Uma repetição que sustenta o plano"
          onClick={() => pick('habito')}
        />
        <SheetAction
          icon={<Icon name="objetivo" className="size-5" />}
          label="Novo objetivo"
          hint="Onde você quer chegar, com prazo"
          onClick={() => pick('objetivo')}
        />
      </div>
    </BottomSheet>
  )
}
