import { Link } from 'react-router-dom'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Button } from '@/presentation/components/ui/Button'
import { ErrorNote } from '@/presentation/components/ui/States'
import { profilePath } from './profile-path'
import { useFollowRequests } from './use-follow-requests'

/**
 * Os pedidos esperando resposta.
 *
 * Só existe pra perfil fechado: perfil aberto aceita na hora, no servidor, e
 * nunca produz linha pendente. Quando não há pedido, o bloco inteiro some — um
 * card dizendo "nenhum pedido" ocuparia espaço permanente pra informar que não
 * há nada, num lugar onde o normal é não haver.
 *
 * Aceitar e recusar tiram a linha no toque. É o gesto certo aqui: o custo de
 * errar é baixo dos dois lados, e ficar olhando um card com spinner é o que
 * faz a pessoa tocar duas vezes e aceitar quem ia recusar.
 */
export function FollowRequestsCard() {
  const requests = useFollowRequests()

  if (requests.loading || requests.list.length === 0) {
    return requests.error ? <ErrorNote message={requests.error} onRetry={requests.reload} /> : null
  }

  return (
    <section
      aria-label="Pedidos pra te acompanhar"
      className="flex flex-col gap-3 rounded-card border border-brand/40 bg-brand-dim/20 p-4"
    >
      <h2 className="text-sm font-semibold tracking-tight text-ink">
        {requests.list.length === 1
          ? 'Uma pessoa quer te acompanhar'
          : `${requests.list.length} pessoas querem te acompanhar`}
      </h2>

      <ul className="flex flex-col gap-3">
        {requests.list.map((person) => (
          <li key={person.id} className="flex items-center gap-3">
            <Link to={profilePath(person.id)} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={person.name} src={person.avatarUrl} className="size-10" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{person.name}</span>
                <span className="block truncate text-xs text-ink-faint">@{person.handle}</span>
              </span>
            </Link>

            <div className="flex shrink-0 gap-1.5">
              <Button size="sm" onClick={() => void requests.accept(person.id)}>
                Aceitar
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void requests.refuse(person.id)}
              >
                Recusar
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {requests.error ? <ErrorNote message={requests.error} /> : null}
    </section>
  )
}
