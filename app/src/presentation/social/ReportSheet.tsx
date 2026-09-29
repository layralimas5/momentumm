import { useEffect, useState } from 'react'
import {
  MAX_REPORT_NOTE,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  type ReportReason,
  type ReportTarget,
} from '@/domain/entities/social-graph'
import { container } from '@/infrastructure/container'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { cn } from '@/shared/lib/cn'

const TITLE: Readonly<Record<ReportTarget, string>> = {
  publicacao: 'Denunciar publicação',
  comentario: 'Denunciar comentário',
  story: 'Denunciar story',
  pessoa: 'Denunciar pessoa',
}

/**
 * A denúncia, na menor versão que ainda é útil.
 *
 * Um motivo da lista e um relato opcional. Não existe categoria em árvore, não
 * existe anexo, não existe acompanhamento do caso: tudo isso é o que uma fila
 * de moderação madura precisa, e não existe fila madura antes de existir
 * denúncia nenhuma.
 *
 * O que já está pronto pro depois é o MODELO: a tabela guarda motivo, alvo,
 * relato e estado, e a mesma linha serve quando houver quem revise. O que não
 * está pronto é a promessa: a folha não diz "vamos responder em 24 horas",
 * porque ninguém vai.
 *
 * Denunciar o mesmo alvo duas vezes é o mesmo registro (chave única no banco),
 * e a tela trata isso como sucesso: pra quem denunciou, o resultado é
 * idêntico, e um erro sobre algo que já deu certo só ensina a tentar de novo.
 */
export function ReportSheet({
  open,
  targetKind,
  targetId,
  onClose,
  onSent,
}: {
  readonly open: boolean
  readonly targetKind: ReportTarget
  readonly targetId: string
  readonly onClose: () => void
  readonly onSent: () => void
}) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) return
    setReason(null)
    setNote('')
  }, [open])

  const send = useAsyncAction(async () => {
    if (!reason) return
    await container.social.report({
      targetKind,
      targetId,
      reason,
      note: note.trim() || null,
    })
    onSent()
  })

  return (
    <BottomSheet
      open={open}
      title={TITLE[targetKind]}
      description="A gente revisa. A pessoa denunciada não fica sabendo quem avisou."
      onClose={onClose}
      footer={
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={!reason || send.running}
          loading={send.running}
          onClick={() => void send.run()}
        >
          <Icon name="bandeira" className="size-4" />
          Enviar denúncia
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium text-ink">Qual é o motivo?</legend>
          {REPORT_REASONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={reason === option}
              onClick={() => setReason(option)}
              className={cn(
                'flex min-h-12 items-center gap-3 rounded-xl border px-3.5 text-left text-sm transition-colors',
                reason === option
                  ? 'border-brand/50 bg-brand-dim/30 text-ink'
                  : 'border-line text-ink-muted active:bg-surface-hi',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full border',
                  reason === option ? 'border-brand bg-brand' : 'border-line-hi',
                )}
              >
                {reason === option ? (
                  <Icon name="check" className="size-3 text-white" strokeWidth={3} />
                ) : null}
              </span>
              {REPORT_REASON_LABELS[option]}
            </button>
          ))}
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">Quer contar mais? (opcional)</span>
          <textarea
            value={note}
            rows={3}
            maxLength={MAX_REPORT_NOTE}
            onChange={(event) => setNote(event.target.value)}
            className="w-full resize-none rounded-xl border border-line bg-surface-hi px-3.5 py-3 text-ink placeholder:text-ink-faint focus:border-brand"
            placeholder="O que aconteceu?"
          />
        </label>

        <div aria-live="polite">{send.error ? <ErrorNote message={send.error} /> : null}</div>
      </div>
    </BottomSheet>
  )
}
