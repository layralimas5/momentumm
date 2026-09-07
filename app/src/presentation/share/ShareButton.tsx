import type { JourneyEvent } from '@/domain/entities/journey-event'
import { Button } from '@/presentation/components/ui/Button'
import { Icon, type IconName } from '@/presentation/components/ui/Icon'
import { useShareStudio } from './ShareStudioProvider'

interface ShareButtonProps {
  readonly label: string
  /**
   * Monta o momento na hora do clique.
   *
   * É uma função e não um objeto pronto porque o dashboard renderiza dezenas de
   * vezes por sessão, e construir seis eventos a cada render pra usar zero
   * deles é trabalho puro. Aqui o custo acontece no clique.
   */
  readonly build: () => JourneyEvent
  readonly variant?: 'primary' | 'secondary' | 'ghost'
  readonly size?: 'sm' | 'md'
  readonly icon?: IconName
  readonly className?: string
}

/** O botão que abre o Share Studio. É o mesmo em toda tela que oferece compartilhar. */
export function ShareButton({
  label,
  build,
  variant = 'secondary',
  size = 'sm',
  icon = 'jornada',
  className,
}: ShareButtonProps) {
  const share = useShareStudio()

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => share.open(build())}
    >
      <Icon name={icon} className="size-4" />
      {label}
    </Button>
  )
}
