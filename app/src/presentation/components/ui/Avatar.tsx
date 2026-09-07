import { initialsOf } from '@/domain/entities/profile'
import { cn } from '@/shared/lib/cn'

interface AvatarProps {
  readonly name: string
  readonly src: string | null
  /** Classe de tamanho do Tailwind (`size-9`, `size-20`). */
  readonly className?: string
  /** Tamanho do texto das iniciais, quando não há foto. */
  readonly textClassName?: string
}

/**
 * A foto do perfil, com as iniciais como reserva.
 *
 * Existe porque o mesmo par foto/iniciais aparece no header, na sidebar, na
 * barra do celular e no perfil. Quatro cópias garantiriam que uma delas
 * continuasse mostrando iniciais depois que a pessoa trocasse a foto — que foi
 * exatamente o estado do app até agora.
 *
 * Sempre decorativo: em todos os lugares onde ele aparece, o nome está escrito
 * do lado ou no rótulo do botão. Repetir o nome no `alt` faria o leitor de tela
 * anunciar a mesma coisa duas vezes.
 */
export function Avatar({ name, src, className, textClassName }: AvatarProps) {
  const shape = cn('shrink-0 overflow-hidden rounded-full', className ?? 'size-9')

  if (src) {
    return <img src={src} alt="" aria-hidden="true" className={cn(shape, 'object-cover')} />
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        shape,
        'grid place-items-center bg-brand-dim font-semibold text-brand-hi',
        textClassName ?? 'text-xs',
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
