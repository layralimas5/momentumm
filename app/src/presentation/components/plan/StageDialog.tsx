import { useState } from 'react'
import { parseDayKey, type DayKey } from '@/domain/entities/day'
import {
  MAX_STAGE_DESCRIPTION,
  MAX_STAGE_TITLE,
  STAGE_STATUSES,
  STAGE_STATUS_LABELS,
  TOTAL_WEIGHT,
  type PlanStage,
  type StageStatus,
} from '@/domain/entities/plan-stage'
import { Button } from '@/presentation/components/ui/Button'
import { ChoiceGroup } from '@/presentation/components/ui/Choice'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { usePlanner } from '@/presentation/planner/use-planner'

/**
 * Criar e editar uma etapa.
 *
 * O peso só aparece na edição, e de propósito: na criação ele é distribuído
 * sozinho, e perguntar "quanto essa etapa vale do objetivo?" antes de a pessoa
 * ter escrito o caminho inteiro é uma pergunta que ninguém consegue responder.
 * Depois que o plano existe, ajustar o peso passa a fazer sentido — e aí a
 * tela mostra a soma em tempo real.
 */
export function StageDialog({
  open,
  objectiveId,
  editing,
  onClose,
}: {
  readonly open: boolean
  readonly objectiveId: string
  readonly editing?: PlanStage | null
  readonly onClose: () => void
}) {
  const planner = usePlanner()

  const [title, setTitle] = useState(editing?.title ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [dueOn, setDueOn] = useState<string>(editing?.dueOn ?? '')
  const [status, setStatus] = useState<StageStatus>(editing?.status ?? 'nao-iniciada')
  const [weight, setWeight] = useState(String(editing?.weight ?? ''))

  const siblings = planner.planStages.filter(
    (stage) => stage.objectiveId === objectiveId && stage.id !== editing?.id,
  )
  const others = siblings.reduce((sum, stage) => sum + stage.weight, 0)
  const typed = Number(weight)
  const total = others + (Number.isFinite(typed) ? typed : 0)

  const submit = useAsyncAction(async () => {
    const dueDay: DayKey | null = dueOn.length === 10 ? parseDayKey(dueOn) : null

    if (editing) {
      await planner.updateStage(editing.id, {
        title: title.trim(),
        description: description.trim() || null,
        dueOn: dueDay,
        status,
        ...(weight.trim() ? { weight: Number(weight) } : {}),
        // Estado e carimbo andam juntos: etapa concluída sem data sai da série
        // que a previsão usa pra medir velocidade.
        completedAt: status === 'concluida' ? (editing.completedAt ?? new Date()) : null,
      })
    } else {
      await planner.createStage({
        objectiveId,
        title: title.trim(),
        description: description.trim() || null,
        dueOn: dueDay,
        status,
      })
    }

    onClose()
  })

  const valid = title.trim().length >= 2

  return (
    <Dialog
      open={open}
      title={editing ? 'Editar etapa' : 'Nova etapa'}
      description={
        editing
          ? 'A etapa é o pedaço do caminho. Mexer no peso muda quanto ela vale do objetivo.'
          : 'Um pedaço do caminho até o objetivo. O peso é distribuído entre as etapas e você ajusta depois.'
      }
      onClose={onClose}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (valid) void submit.run()
        }}
      >
        <Field label="Nome da etapa" error={submit.error}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              value={title}
              maxLength={MAX_STAGE_TITLE}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="MVP"
              autoFocus
            />
          )}
        </Field>

        <Field label="Descrição" hint="Opcional. O que precisa estar pronto pra ela fechar.">
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              value={description}
              maxLength={MAX_STAGE_DESCRIPTION}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Dashboard, onboarding e pagamentos funcionando"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data prevista" hint="Opcional. É ela que marca a etapa como atrasada.">
            {(id, describedBy) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                type="date"
                value={dueOn}
                onChange={(event) => setDueOn(event.target.value)}
              />
            )}
          </Field>

          {editing ? (
            <Field
              label="Peso no objetivo"
              hint={
                total === TOTAL_WEIGHT
                  ? 'As etapas somam 100%.'
                  : `As etapas somam ${total}%. Precisa fechar 100% pra salvar.`
              }
            >
              {(id, describedBy) => (
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={TOTAL_WEIGHT}
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                />
              )}
            </Field>
          ) : null}
        </div>

        {editing ? (
          <div>
            <p className="text-sm font-medium text-ink">Situação</p>
            <ChoiceGroup
              className="mt-1.5"
              size="sm"
              label="Situação da etapa"
              value={status}
              onChange={setStatus}
              options={STAGE_STATUSES.map((item) => ({
                value: item,
                label: STAGE_STATUS_LABELS[item],
              }))}
            />
            <p className="mt-2 text-xs text-ink-faint">
              “Atrasada” não é uma opção: ela vem sozinha quando a data prevista passa.
            </p>
          </div>
        ) : (
          <Field label="Situação">
            {(id) => (
              <Select
                id={id}
                value={status}
                onChange={(event) => setStatus(event.target.value as StageStatus)}
              >
                {STAGE_STATUSES.filter((item) => item !== 'concluida').map((item) => (
                  <option key={item} value={item}>
                    {STAGE_STATUS_LABELS[item]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valid} loading={submit.running}>
            {editing ? 'Salvar etapa' : 'Criar etapa'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
