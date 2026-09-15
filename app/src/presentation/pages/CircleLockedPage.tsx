import { Link } from 'react-router-dom'
import { CIRCLE_LAUNCH_SUBSCRIBERS } from '@/infrastructure/config/env'
import { buttonClass } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { Panel } from '@/presentation/components/ui/Surface'
import { PageHeader } from './PageHeader'

/**
 * O que aparece em `/app/circulo` e `/app/desafios` enquanto o Círculo não
 * abriu. A rota existe (link salvo não vira 404), mas a tela diz a verdade em
 * vez de mostrar uma comunidade vazia.
 */
export function CircleLockedPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 lg:gap-6">
      <PageHeader title="Círculo" description="Ainda não abriu. E é de propósito." />

      <Panel tone="brand">
        <div className="flex items-start gap-3">
          <Icon name="cadeado" className="mt-0.5 size-5 shrink-0 text-brand-ink" />
          <div className="min-w-0">
            <p className="text-base font-semibold text-balance text-ink">
              O Círculo entra no ar quando o Momentumm chegar a {CIRCLE_LAUNCH_SUBSCRIBERS} assinantes.
            </p>
            <p className="mt-2 text-sm text-pretty text-ink-muted">
              Uma comunidade vazia ensina a ignorar a aba. Até lá o app é só teu: objetivo, plano,
              dia e progresso. Quando abrir, você fica sabendo aqui dentro.
            </p>
            <Link
              to="/app"
              className={buttonClass({ variant: 'secondary', size: 'sm', className: 'mt-4' })}
            >
              <Icon name="setaEsq" className="size-4" />
              Voltar pra Hoje
            </Link>
          </div>
        </div>
      </Panel>
    </div>
  )
}
