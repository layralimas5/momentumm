import { useNavigate } from 'react-router-dom'
import { circleOpen } from '@/infrastructure/config/env'
import { BottomSheet, SheetAction } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { usePostComposer } from '@/presentation/social/PostComposerProvider'

/**
 * "Adicionar Bloco ou Conectar a Objetivo": a única porta de criação do app.
 * Tarefa, rotina, hábito, compromisso, objetivo e bloco de foco, cada um no
 * formulário que já existe pra ele.
 */
export function AddSheet({ open, onClose }: { readonly open: boolean; readonly onClose: () => void }) {
  const composer = useComposer()
  const post = usePostComposer()
  const navigate = useNavigate()

  const go = (action: () => void) => () => {
    onClose()
    action()
  }

  return (
    <BottomSheet open={open} title="Adicionar" onClose={onClose}>
      <div className="flex flex-col gap-1">
        <SheetAction
          icon={<Icon name="check" className="size-5" />}
          label="Tarefa"
          hint="Uma ação concreta, ligada ou não a um objetivo"
          tone="brand"
          onClick={go(() => composer.open('acao'))}
        />
        <SheetAction
          icon={<Icon name="relogio" className="size-5" />}
          label="Bloco de rotina"
          hint="Algo que se repete num horário"
          onClick={go(() => navigate('/app/rotina?novo=1'))}
        />
        <SheetAction
          icon={<Icon name="habitos" className="size-5" />}
          label="Hábito"
          hint="A repetição que segura o plano"
          onClick={go(() => composer.open('habito'))}
        />
        <SheetAction
          icon={<Icon name="calendarioGrade" className="size-5" />}
          label="Compromisso"
          hint="Uma vez só, com dia e hora"
          onClick={go(() => navigate('/app/rotina?novo=1&tipo=compromisso'))}
        />
        <SheetAction
          icon={<Icon name="bussola" className="size-5" />}
          label="Objetivo"
          hint="Onde você quer chegar, com prazo"
          onClick={go(() => composer.open('objetivo'))}
        />
        <SheetAction
          icon={<Icon name="cronometro" className="size-5" />}
          label="Bloco de foco"
          hint="Cronômetro pra uma sessão concentrada"
          onClick={go(() => navigate('/app/foco'))}
        />
        {circleOpen ? (
          <SheetAction
            icon={<Icon name="camera" className="size-5" />}
            label="Provar no Círculo"
            hint="Uma foto do que você fez hoje"
            onClick={go(() => post.open())}
          />
        ) : null}
      </div>
    </BottomSheet>
  )
}
