import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { JourneyEvent } from '@/domain/entities/journey-event'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Dialog } from '@/presentation/components/ui/Dialog'
import { useAuth } from '@/presentation/auth/use-auth'
import { useIsDesktop } from '@/presentation/hooks/use-media-query'
import { usePlanner } from '@/presentation/planner/use-planner'
import { ShareStudio } from './ShareStudio'

interface ShareControls {
  /** Abre o Share Studio com o momento recebido. */
  open(event: JourneyEvent): void
  close(): void
}

const ShareStudioContext = createContext<ShareControls | null>(null)

const TITLE = 'Compartilhe seu progresso'
const DESCRIPTION = 'Transforme sua evolução em algo que vale a pena lembrar.'

/**
 * O Share Studio mora acima das páginas.
 *
 * Os botões de compartilhar aparecem no dia, na rotina, no objetivo, na review
 * e no momentum — cinco telas diferentes abrindo o MESMO estúdio. Um modal por
 * tela seria o começo da divergência: em dois meses o card do objetivo teria um
 * template que o card da semana não tem.
 *
 * A camada modal segue a regra do app: `Dialog` no desktop, `BottomSheet` no
 * celular.
 */
export function ShareStudioProvider({ children }: { children: ReactNode }) {
  const [event, setEvent] = useState<JourneyEvent | null>(null)
  const isDesktop = useIsDesktop()
  const { profile } = useAuth()
  const { today } = usePlanner()

  const controls = useMemo<ShareControls>(
    () => ({
      open: (next) => setEvent(next),
      close: () => setEvent(null),
    }),
    [],
  )

  const displayName = profile?.name.split(' ')[0] ?? null

  const content = event ? (
    <ShareStudio
      event={event}
      displayName={displayName}
      today={today}
      compact={!isDesktop}
    />
  ) : null

  return (
    <ShareStudioContext.Provider value={controls}>
      {children}

      {isDesktop ? (
        <Dialog
          open={event !== null}
          size="xl"
          title={TITLE}
          description={DESCRIPTION}
          onClose={controls.close}
        >
          {content}
        </Dialog>
      ) : (
        <BottomSheet
          open={event !== null}
          title={TITLE}
          description={DESCRIPTION}
          onClose={controls.close}
        >
          {content}
        </BottomSheet>
      )}
    </ShareStudioContext.Provider>
  )
}

export function useShareStudio(): ShareControls {
  const controls = useContext(ShareStudioContext)
  if (!controls) {
    throw new Error('useShareStudio precisa estar dentro de <ShareStudioProvider>.')
  }
  return controls
}
