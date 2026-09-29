import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ProfileCard } from '@/domain/entities/social-graph'
import { container } from '@/infrastructure/container'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { FollowButton } from './FollowButton'
import { profilePath } from './profile-path'

/**
 * Quem seguir, quando o feed ainda não tem o que mostrar.
 *
 * ## Só gente de verdade
 *
 * A lista vem de `suggested_profiles`: perfis PÚBLICOS que já publicaram, que
 * a pessoa ainda não segue e não bloqueou. Se não houver ninguém, o bloco
 * inteiro não aparece — e isso é melhor do que três cartões inventados, porque
 * o primeiro toque num perfil que não existe é o momento em que a pessoa
 * decide que o app mente.
 *
 * ## A ordem não é "quem tem mais seguidores"
 *
 * É quem publicou por último. Ordenar por audiência montaria a tabela de
 * classificação que o produto recusa, com outro nome, e logo na primeira tela
 * de quem acabou de chegar.
 */
export function SuggestedProfiles({ title = 'Quem seguir' }: { readonly title?: string }) {
  const [people, setPeople] = useState<readonly ProfileCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void container.social
      .suggestions(8)
      .then((list) => {
        if (alive) setPeople(list)
      })
      .catch(() => {
        // Sugestão é conveniência: falhar aqui não merece alarme vermelho em
        // cima de um feed que já está dizendo que está vazio.
        if (alive) setPeople([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  if (loading || people.length === 0) return null

  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>

      <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 px-3.5 py-3">
            <Link to={profilePath(person.id)} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={person.name} src={person.avatarUrl} className="size-11" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{person.name}</span>
                <span className="block truncate text-xs text-ink-faint">@{person.handle}</span>
              </span>
            </Link>
            <FollowButton userId={person.id} size="sm" />
          </li>
        ))}
      </ul>
    </section>
  )
}
