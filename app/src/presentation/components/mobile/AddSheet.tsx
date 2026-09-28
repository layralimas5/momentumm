import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MAX_WIN_LENGTH, WIN_SUGGESTIONS } from '@/domain/entities/win'
import { Button } from '@/presentation/components/ui/Button'
import { BottomSheet, SheetAction } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { usePlanner } from '@/presentation/planner/use-planner'

/** A tela de onde o "+" foi tocado. É ela que decide o que a folha oferece. */
export type AddContext = 'hoje' | 'rotina'

const SHEET_TITLE: Readonly<Record<AddContext, string>> = {
  hoje: 'Adicionar para hoje',
  rotina: 'Adicionar à rotina',
}

const SHEET_NOTE: Readonly<Record<AddContext, string>> = {
  hoje: 'O que entra no teu dia de hoje?',
  rotina: 'O que passa a fazer parte dos teus dias?',
}

/**
 * O que o "+" adiciona, e isso depende de onde ele foi tocado.
 *
 * Antes era uma folha só, com seis ações fixas, aberta pelo botão central da
 * barra: dentro da Rotina ela oferecia "criar objetivo", dentro do Progresso
 * oferecia "item da rotina". Uma lista que serve pra tudo não serve pra tela
 * nenhuma, e a pessoa lia as seis linhas toda vez pra achar a que queria.
 *
 * Agora a primeira linha é a resposta provável daquela tela, em tom de marca, e
 * as outras são as vizinhas dela. O que saiu daqui não saiu do app: objetivo,
 * meta, hábito e dupla têm botão de criar nas próprias telas, e continuam na
 * busca rápida e nos atalhos do Perfil.
 *
 * ## Compromisso não é entidade nova
 *
 * "Dentista, terça, 10:30" é um item de rotina com recorrência `unica`. Criar
 * uma tabela de compromissos ao lado seria um segundo motor de dia, com uma
 * segunda conta de "o que tenho hoje", divergindo da primeira na primeira
 * regra nova. O que muda entre os dois é o preenchimento inicial do
 * formulário, e é só isso que o parâmetro `tipo` carrega.
 */
export function AddSheet({
  open,
  context,
  onClose,
}: {
  readonly open: boolean
  readonly context: AddContext
  readonly onClose: () => void
}) {
  const composer = useComposer()
  const navigate = useNavigate()
  const [winOpen, setWinOpen] = useState(false)

  const pick = (kind: 'acao' | 'habito') => {
    onClose()
    composer.open(kind)
  }

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  return (
    <>
      <BottomSheet
        open={open && !winOpen}
        title={SHEET_TITLE[context]}
        description={SHEET_NOTE[context]}
        onClose={onClose}
      >
        <div className="flex flex-col gap-1">
          {context === 'hoje' ? (
            <>
              <SheetAction
                icon={<Icon name="jornada" className="size-5" />}
                label="Ação"
                hint="Uma coisa concreta pra fazer hoje"
                tone="brand"
                onClick={() => pick('acao')}
              />
              <SheetAction
                icon={<Icon name="relogio" className="size-5" />}
                label="Compromisso"
                hint="Com hora marcada, numa data só"
                onClick={() => go('/app/rotina?novo=1&tipo=compromisso')}
              />
              <SheetAction
                icon={<Icon name="habitos" className="size-5" />}
                label="Hábito"
                hint="Uma repetição que sustenta a meta"
                onClick={() => pick('habito')}
              />
              {/*
                A saída pra recorrência fica por último e em voz baixa: quem
                abriu o "+" no Hoje quer resolver hoje. Ela existe pro momento
                em que a pessoa percebe, no meio do gesto, que aquilo não é de
                hoje, é de todo dia.
              */}
              <SheetAction
                icon={<Icon name="calendario" className="size-5" />}
                label="Item da rotina"
                hint="O que se repete, e passa a aparecer sozinho aqui"
                onClick={() => go('/app/rotina?novo=1')}
              />
              <SheetAction
                icon={<Icon name="trofeu" className="size-5" />}
                label="Vitória do dia"
                hint="O que avançou, mesmo que pequeno"
                onClick={() => setWinOpen(true)}
              />
            </>
          ) : (
            <>
              <SheetAction
                icon={<Icon name="calendario" className="size-5" />}
                label="Item da rotina"
                hint="O que se repete no seu dia"
                tone="brand"
                onClick={() => go('/app/rotina?novo=1')}
              />
              <SheetAction
                icon={<Icon name="relogio" className="size-5" />}
                label="Compromisso"
                hint="Com hora marcada, numa data só"
                onClick={() => go('/app/rotina?novo=1&tipo=compromisso')}
              />
              <SheetAction
                icon={<Icon name="habitos" className="size-5" />}
                label="Hábito"
                hint="Uma repetição que sustenta a meta"
                onClick={() => pick('habito')}
              />
              <SheetAction
                icon={<Icon name="objetivo" className="size-5" />}
                label="Ação de objetivo"
                hint="Um passo do plano, com dia e hora"
                onClick={() => pick('acao')}
              />
            </>
          )}
        </div>
      </BottomSheet>

      <WinSheet
        open={winOpen}
        onClose={() => {
          setWinOpen(false)
          onClose()
        }}
      />
    </>
  )
}

function WinSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const planner = usePlanner()
  const [text, setText] = useState('')

  const save = useAsyncAction(async () => {
    await planner.saveWin({ day: planner.today, text })
    setText('')
    onClose()
  })

  const canSave = text.trim().length >= 2

  return (
    <BottomSheet
      open={open}
      title="Vitória do dia"
      description="O que avançou hoje, mesmo que tenha sido pequeno?"
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (canSave) void save.run()
        }}
      >
        <input
          value={text}
          maxLength={MAX_WIN_LENGTH}
          onChange={(event) => setText(event.target.value)}
          placeholder="Abri o livro, mesmo sem energia."
          aria-label="Vitória do dia"
          autoFocus
          className="h-13 w-full rounded-xl border border-line bg-surface-hi px-4 text-ink placeholder:text-ink-faint focus:border-brand"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {WIN_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setText(suggestion)}
              className="min-h-11 rounded-full border border-line px-3.5 text-sm text-ink-muted transition-colors active:bg-surface-top"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <div aria-live="polite" className="min-h-6">
          {save.error ? <p className="mt-2 text-sm text-danger">{save.error}</p> : null}
        </div>

        <Button type="submit" size="lg" className="mt-2 w-full" disabled={!canSave} loading={save.running}>
          <Icon name="check" className="size-4" />
          Salvar vitória
        </Button>
      </form>
    </BottomSheet>
  )
}
