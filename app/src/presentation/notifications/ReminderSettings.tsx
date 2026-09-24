import { INACTIVITY_HOURS, NOTIFICATION_WINDOW } from '@/domain/notifications/push-device'
import { Button } from '@/presentation/components/ui/Button'
import { cn } from '@/shared/lib/cn'
import { NotificationPreferences } from './NotificationPreferences'
import { usePushReminders } from './use-push-reminders'

/**
 * O lembrete em Configurações: o estado deste aparelho, o botão de ligar ou
 * desligar e — com o lembrete ligado — o que cada aviso é. Diferente do
 * convite do Hoje, este bloco existe sempre que há chave configurada,
 * inclusive pra explicar por que não dá (permissão negada, iPhone fora da
 * tela de início).
 *
 * As categorias só aparecem depois de ligado de propósito: escolher o que
 * receber antes de aceitar receber é uma tela de opções que não faz nada.
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
            : `No máximo um aviso por dia, entre ${NOTIFICATION_WINDOW.startHour}h e ${NOTIFICATION_WINDOW.endHour}h30, quando existe ação em aberto e já faz ${INACTIVITY_HOURS} horas que você não passa por aqui. Vale pra este aparelho.`}
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

      {reminders.enabled ? <NotificationPreferences /> : null}
    </div>
  )
}
