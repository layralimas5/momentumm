import { REMINDER_HOUR } from '@/domain/notifications/push-device'
import { Button } from '@/presentation/components/ui/Button'
import { cn } from '@/shared/lib/cn'
import { usePushReminders } from './use-push-reminders'

/**
 * O lembrete em Configurações: o estado deste aparelho e o botão de ligar
 * ou desligar. Diferente do convite do Hoje, este bloco existe sempre que
 * há chave configurada, inclusive pra explicar por que não dá (permissão
 * negada, iPhone fora da tela de início).
 */
export function ReminderSettings() {
  const reminders = usePushReminders()

  if (!reminders.available && !reminders.needsInstall) return null

  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">Lembrete diário</p>
        <span
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-medium',
            reminders.enabled
              ? 'border-brand/40 bg-brand-dim/50 text-brand-ink'
              : 'border-line text-ink-muted',
          )}
        >
          {reminders.loading ? '…' : reminders.enabled ? 'Ligado' : 'Desligado'}
        </span>
      </div>

      <p className="mt-2 text-sm text-ink-muted">
        {reminders.needsInstall
          ? `No iPhone, o lembrete só funciona com o app na tela de início: toca em Compartilhar e depois em "Adicionar à Tela de Início". Depois volta aqui e liga.`
          : reminders.permission === 'denied'
            ? 'As notificações estão bloqueadas pra este site no navegador. Libera nas configurações do site e volta aqui.'
            : `Um aviso às ${REMINDER_HOUR}h só nos dias em que você não abrir o app. Vale pra este aparelho.`}
      </p>

      {reminders.error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {reminders.error}
        </p>
      ) : null}

      {reminders.available && reminders.permission !== 'denied' ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-3 w-full"
          loading={reminders.busy}
          disabled={reminders.loading}
          onClick={() => void (reminders.enabled ? reminders.disable() : reminders.enable())}
        >
          {reminders.enabled ? 'Desligar lembrete' : 'Ligar lembrete'}
        </Button>
      ) : null}
    </div>
  )
}
