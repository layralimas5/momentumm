import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MAX_WIN_LENGTH, WIN_SUGGESTIONS } from '@/domain/entities/win'
import { Button } from '@/presentation/components/ui/Button'
import { BottomSheet, SheetAction } from '@/presentation/components/ui/BottomSheet'
import { Icon } from '@/presentation/components/ui/Icon'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { useFeature } from '@/presentation/plan/use-feature'
import { useComposer } from '@/presentation/planner/ComposerProvider'
import { usePlanner } from '@/presentation/planner/use-planner'

/**
 * O que o botão central adiciona.
 *
 * Ação, hábito e meta reaproveitam o mesmo formulário do desktop, e o objetivo
 * abre a mesma entrevista curta do onboarding. A vitória do dia é uma linha só —
 * abrir um formulário inteiro pra ela seria fricção sem motivo, então ela é
 * resolvida aqui mesmo.
 *
 * A dupla também entra aqui, e não é desvio de tema: o que se adiciona é uma
 * PESSOA. Foi por não existir nessa folha que o Juntos ficava alcançável só
 * pela barra lateral e pelos atalhos do perfil — dois lugares onde ninguém vai
 * procurar por alguém pra combinar.
 */
export function AddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const composer = useComposer()
  const navigate = useNavigate()
  const juntos = useFeature('juntos')
  const [winOpen, setWinOpen] = useState(false)

  const pick = (kind: 'acao' | 'habito' | 'meta' | 'objetivo') => {
    onClose()
    composer.open(kind)
  }

  return (
    <>
      <BottomSheet
        open={open && !winOpen}
        title="Adicionar"
        description="O que você quer colocar em movimento?"
        onClose={onClose}
      >
        <div className="flex flex-col gap-1">
          <SheetAction
            icon={<Icon name="jornada" className="size-5" />}
            label="Ação"
            hint="Uma coisa concreta pra hoje ou amanhã"
            tone="brand"
            onClick={() => pick('acao')}
          />
          <SheetAction
            icon={<Icon name="habitos" className="size-5" />}
            label="Hábito"
            hint="Uma repetição que sustenta a meta"
            onClick={() => pick('habito')}
          />
          <SheetAction
            icon={<Icon name="metas" className="size-5" />}
            label="Meta"
            hint="Um número e um período"
            onClick={() => pick('meta')}
          />
          <SheetAction
            icon={<Icon name="objetivo" className="size-5" />}
            label="Objetivo"
            hint="Com prazo, e o plano sai pronto"
            onClick={() => pick('objetivo')}
          />
          <SheetAction
            icon={<Icon name="trofeu" className="size-5" />}
            label="Vitória do dia"
            hint="O que avançou, mesmo que pequeno"
            onClick={() => setWinOpen(true)}
          />
          {juntos.enabled ? (
            <SheetAction
              icon={<Icon name="metas" className="size-5" />}
              label="Uma pessoa na dupla"
              hint="Alguém que vê se você avançou no dia"
              onClick={() => {
                onClose()
                navigate('/app/juntos')
              }}
            />
          ) : null}
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
