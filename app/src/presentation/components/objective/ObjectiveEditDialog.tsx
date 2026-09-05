import { useEffect, useState, type FormEvent } from 'react'
import { parseDayKey } from '@/domain/entities/day'
import {
  MAX_OBJECTIVE_DESCRIPTION,
  MAX_OBJECTIVE_MOTIVE,
  MAX_OBJECTIVE_TITLE,
  type Objective,
} from '@/domain/entities/objective'
import { PRIORITIES, PRIORITY_LABELS, type Priority } from '@/domain/entities/priority'
import { Button } from '@/presentation/components/ui/Button'
import { ChoiceGroup } from '@/presentation/components/ui/Choice'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { usePlanner } from '@/presentation/planner/use-planner'

/**
 * Edição do objetivo já criado.
 *
 * Não dá pra trocar a área: o progresso é somado das atividades daquele eixo,
 * então mudar de área faria o número saltar sem nada ter acontecido. Quem
 * errou a área arquiva e cria de novo — é mais honesto que um progresso que
 * mente.
 */
export function ObjectiveEditDialog({
  open,
  objective,
  onClose,
}: {
  readonly open: boolean
  readonly objective: Objective
  readonly onClose: () => void
}) {
  const planner = usePlanner()

  const [title, setTitle] = useState(objective.title)
  const [description, setDescription] = useState(objective.description ?? '')
  const [motive, setMotive] = useState(objective.motive ?? '')
  const [priority, setPriority] = useState<Priority>(objective.priority)
  const [target, setTarget] = useState(String(objective.target))
  const [deadline, setDeadline] = useState<string>(objective.deadline)

  // Reabrir com o objetivo já atualizado: sem isso o formulário mostraria os
  // valores da primeira abertura depois de um salvamento.
  useEffect(() => {
    if (!open) return
    setTitle(objective.title)
    setDescription(objective.description ?? '')
    setMotive(objective.motive ?? '')
    setPriority(objective.priority)
    setTarget(String(objective.target))
    setDeadline(objective.deadline)
  }, [open, objective])

  const save = useAsyncAction(async () => {
    await planner.updateObjective(objective.id, {
      title: title.trim(),
      description: description.trim() || null,
      motive: motive.trim() || null,
      priority,
      target: Number(target),
      deadline: parseDayKey(deadline),
    })
    onClose()
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void save.run()
  }

  return (
    <Dialog
      open={open}
      title="Editar objetivo"
      description="Mudar o prazo ou o alvo não é desistir. É o que evita abandonar um objetivo que só estava mal dimensionado."
      onClose={onClose}
    >
      <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
        {save.error ? <ErrorNote message={save.error} /> : null}

        <Field label="Objetivo">
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              value={title}
              maxLength={MAX_OBJECTIVE_TITLE}
              required
              onChange={(event) => setTitle(event.target.value)}
            />
          )}
        </Field>

        <Field label="Descrição" hint="Opcional.">
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              value={description}
              maxLength={MAX_OBJECTIVE_DESCRIPTION}
              onChange={(event) => setDescription(event.target.value)}
            />
          )}
        </Field>

        <Field label="Por que isso importa" hint="É o que a tela te mostra num dia ruim.">
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              value={motive}
              maxLength={MAX_OBJECTIVE_MOTIVE}
              onChange={(event) => setMotive(event.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Alvo">
            {(id, describedBy) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                type="number"
                min={1}
                value={target}
                required
                onChange={(event) => setTarget(event.target.value)}
              />
            )}
          </Field>

          <Field label="Prazo">
            {(id, describedBy) => (
              <TextInput
                id={id}
                aria-describedby={describedBy}
                type="date"
                value={deadline}
                required
                onChange={(event) => setDeadline(event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink">Prioridade</span>
          <ChoiceGroup
            label="Prioridade do objetivo"
            value={priority}
            options={PRIORITIES.map((item) => ({ value: item, label: PRIORITY_LABELS[item] }))}
            onChange={setPriority}
          />
        </div>

        <div className="mt-2 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={save.running}>
            Salvar
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
