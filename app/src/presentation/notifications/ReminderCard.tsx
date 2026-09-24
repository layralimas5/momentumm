import { INACTIVITY_HOURS } from '@/domain/notifications/push-device'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { useInstallApp } from '@/presentation/pwa/use-install-app'
import { usePushReminders } from './use-push-reminders'

/**
 * O convite do Hoje pra ligar o lembrete no celular.
 *
 * Só aparece quando dá pra ligar de verdade: chave configurada, navegador
 * capaz, permissão ainda não negada, e a pessoa não fechou o convite. Fechar
 * é definitivo neste aparelho; Configurações continua oferecendo.
 *
 * Não pede permissão sozinho: o navegador só deixa perguntar uma vez, e uma
 * pergunta sem contexto é uma pergunta negada. O texto diz o que vai chegar
 * ANTES de o sistema perguntar, porque é a única chance de a pessoa decidir
 * com informação.
 *
 * Nunca divide a tela com o convite de instalar: dois cards pedindo coisas
 * diferentes no mesmo lugar viram um bloco que a pessoa aprende a pular. A
 * instalação vem primeiro — no iPhone ela é pré-requisito do aviso.
 */
export function ReminderCard() {
  const reminders = usePushReminders()
  const install = useInstallApp()

  if (install.shouldOffer) return null
  if (!reminders.available || reminders.loading) return null
  if (reminders.enabled || reminders.dismissed || reminders.permission === 'denied') return null

  return (
    <Panel tone="brand" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand-ink uppercase">
          <Icon name="sino" className="size-4" />
          Lembretes
        </p>
        <p className="mt-2 text-base font-semibold text-balance text-ink">
          Quer que o Momentumm te lembre do próximo passo quando o dia ficar corrido?
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Um aviso só, e só quando existe ação sua em aberto e já faz umas {INACTIVITY_HOURS} horas
          que você não passa por aqui. Dá pra desligar em Configurações.
        </p>
        {reminders.error ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {reminders.error}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm" onClick={reminders.dismiss} disabled={reminders.busy}>
          Agora não
        </Button>
        <Button className="min-h-12" loading={reminders.busy} onClick={() => void reminders.enable()}>
          Ativar lembretes
        </Button>
      </div>
    </Panel>
  )
}
