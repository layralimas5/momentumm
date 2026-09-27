import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CLUB_CATEGORIES,
  CLUB_CATEGORY_LABELS,
  CLUB_PRIVACIES,
  CLUB_PRIVACY_HINTS,
  CLUB_PRIVACY_LABELS,
  MAX_CLUB_DESCRIPTION,
  MAX_CLUB_NAME,
  type ClubCategory,
  type ClubPrivacy,
  type NewClubInput,
} from '@/domain/entities/club'
import { BANNER_PRESETS, type BannerPreset } from '@/domain/entities/profile-banner'
import { track } from '@/infrastructure/analytics/track'
import { BottomSheet } from '@/presentation/components/ui/BottomSheet'
import { Button } from '@/presentation/components/ui/Button'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { Icon } from '@/presentation/components/ui/Icon'
import { ProfileBanner } from '@/presentation/profile/ProfileBanner'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { cn } from '@/shared/lib/cn'

/**
 * Criar um clube, ou conhecer o PRO.
 *
 * As duas coisas moram na mesma folha de propósito. Quem não assina abre o
 * mesmo caminho de quem assina e vê o que o recurso é antes de ver o preço:
 * bloquear o botão na lista ensinaria que aquilo ali não é pra ela, e ninguém
 * assina o que nunca viu funcionando.
 *
 * O paywall não interrompe nada. Ele mora no fim de uma ação que a pessoa
 * escolheu começar, e não no meio do dia dela.
 */
export function ClubComposer({
  open,
  canCreate,
  onClose,
  onCreate,
}: {
  readonly open: boolean
  readonly canCreate: boolean
  readonly onClose: () => void
  readonly onCreate: (input: NewClubInput) => Promise<unknown>
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ClubCategory>('geral')
  const [cover, setCover] = useState<BannerPreset>('aurora')
  const [privacy, setPrivacy] = useState<ClubPrivacy>('convite')

  const save = useAsyncAction(async () => {
    await onCreate({ name, description: description.trim() || null, category, cover, privacy })
    setName('')
    setDescription('')
    onClose()
  })

  if (!canCreate) {
    return (
      <BottomSheet open={open} title="Crie sua própria comunidade" onClose={onClose}>
        <Paywall onClose={onClose} />
      </BottomSheet>
    )
  }

  return (
    <BottomSheet
      open={open}
      title="Novo clube"
      description="Um lugar que dura mais que um desafio."
      onClose={onClose}
    >
      <form
        className="flex flex-col gap-4 pb-1"
        onSubmit={(event) => {
          event.preventDefault()
          void save.run()
        }}
      >
        <ProfileBanner banner={cover} className="h-20 rounded-2xl" />

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Capa">
          {BANNER_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={preset === cover}
              onClick={() => setCover(preset)}
              className={cn(
                'size-12 shrink-0 overflow-hidden rounded-xl border-2 transition-colors',
                preset === cover ? 'border-brand' : 'border-transparent',
              )}
            >
              <ProfileBanner banner={preset} className="size-full" />
              <span className="sr-only">Capa {preset}</span>
            </button>
          ))}
        </div>

        <Field label="Nome">
          {(id) => (
            <TextInput
              id={id}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_CLUB_NAME}
              placeholder="Projeto 90 dias"
            />
          )}
        </Field>

        <Field label="Sobre o que é" hint={`${description.length}/${MAX_CLUB_DESCRIPTION}`}>
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={MAX_CLUB_DESCRIPTION}
              placeholder="Três meses de constância, um dia de cada vez."
            />
          )}
        </Field>

        <fieldset>
          <legend className="text-sm font-medium text-ink">Categoria</legend>
          <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {CLUB_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={item === category}
                onClick={() => setCategory(item)}
                className={cn(
                  'min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors',
                  item === category
                    ? 'border-brand bg-brand-dim/60 text-ink'
                    : 'border-line text-ink-muted active:bg-surface-hi',
                )}
              >
                {CLUB_CATEGORY_LABELS[item]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-ink">Quem pode entrar</legend>
          <div className="mt-2 flex flex-col gap-2">
            {CLUB_PRIVACIES.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={item === privacy}
                onClick={() => setPrivacy(item)}
                className={cn(
                  'rounded-xl border px-3.5 py-3 text-left transition-colors',
                  item === privacy
                    ? 'border-brand bg-brand-dim/40'
                    : 'border-line active:bg-surface-hi',
                )}
              >
                <span className="block text-sm font-medium text-ink">
                  {CLUB_PRIVACY_LABELS[item]}
                </span>
                <span className="mt-0.5 block text-xs text-ink-faint">
                  {CLUB_PRIVACY_HINTS[item]}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        <div aria-live="polite" className="min-h-5">
          {save.error ? <p className="text-sm text-danger">{save.error}</p> : null}
        </div>

        <Button type="submit" size="lg" className="w-full" loading={save.running}>
          Criar clube
        </Button>
      </form>
    </BottomSheet>
  )
}

/** O convite ao PRO, no fim de uma ação que a pessoa escolheu começar. */
function Paywall({ onClose }: { readonly onClose: () => void }) {
  return (
    <div className="flex flex-col gap-4 pb-1">
      <p className="text-sm text-pretty text-ink-muted">
        Reúna pessoas com o mesmo objetivo, acompanhe o progresso de todo mundo e evoluam juntos.
        Criar clubes faz parte do Momentumm PRO.
      </p>

      <ul className="flex flex-col gap-2.5">
        <Bullet>Clube próprio, com capa, categoria e regras de entrada.</Bullet>
        <Bullet>Ranking do grupo, somando os dias cumpridos nos desafios do clube.</Bullet>
        <Bullet>Desafios em grupo, no lugar de combinados soltos.</Bullet>
      </ul>

      <Link
        to="/app/assinatura"
        onClick={() => {
          track('club_creation_upgrade_clicked', 'desafios')
          onClose()
        }}
        className="flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-brand text-base font-semibold text-white transition-colors active:bg-brand-hi"
      >
        Criar com PRO
        <Icon name="seta" className="size-4" />
      </Link>

      <p className="text-center text-xs text-ink-faint">
        Você continua no seu círculo e nos desafios de que já participa.
      </p>
    </div>
  )
}

function Bullet({ children }: { readonly children: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-ink-muted">
      <Icon name="check" className="mt-0.5 size-4 shrink-0 text-positive" strokeWidth={2.5} />
      <span className="text-pretty">{children}</span>
    </li>
  )
}
