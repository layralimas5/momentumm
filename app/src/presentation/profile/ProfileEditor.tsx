import { useRef, useState } from 'react'
import { MAX_BIO_LENGTH, MAX_NAME_LENGTH, type Profile } from '@/domain/entities/profile'
import { container } from '@/infrastructure/container'
import { Avatar } from '@/presentation/components/ui/Avatar'
import { Button } from '@/presentation/components/ui/Button'
import { Field, TextInput } from '@/presentation/components/ui/Field'
import { Icon } from '@/presentation/components/ui/Icon'
import { ErrorNote } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'
import { toUserMessage } from '@/shared/errors'
import { downscaleToAvatar } from './downscale-image'

interface ProfileEditorProps {
  readonly profile: Profile
  readonly onSaved: () => Promise<void>
  readonly onCancel: () => void
}

/**
 * Editar nome, foto e bio.
 *
 * Só esses três. O @ e a visibilidade padrão continuam em Configurações: são
 * ajustes de conta, e misturá-los aqui transformaria a página da evolução
 * pessoal em mais um formulário.
 *
 * A foto é aplicada na hora do salvamento, junto do resto — trocar a imagem e
 * sair sem salvar não deve deixar uma foto nova pendurada no perfil.
 */
export function ProfileEditor({ profile, onSaved, onCancel }: ProfileEditorProps) {
  const [name, setName] = useState(profile.name)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const save = useAsyncAction(async () => {
    await container.profiles.update(profile.id, {
      name,
      bio: bio.trim() || null,
      avatarUrl,
    })
    await onSaved()
  })

  const pickPhoto = async (file: File): Promise<void> => {
    setPhotoError(null)
    try {
      setAvatarUrl(await downscaleToAvatar(file))
    } catch (cause) {
      setPhotoError(toUserMessage(cause))
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        void save.run()
      }}
    >
      {save.error ? <ErrorNote message={save.error} /> : null}

      <div className="flex items-center gap-4">
        <Avatar
          name={name || profile.name}
          src={avatarUrl}
          className="size-20"
          textClassName="text-xl"
        />

        <div className="flex min-w-0 flex-col items-start gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void pickPhoto(file)
              // Zera o campo: sem isso, escolher a MESMA foto de novo depois de
              // remover não dispara evento nenhum.
              event.target.value = ''
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
              <Icon name="editar" className="size-4" />
              {avatarUrl ? 'Trocar foto' : 'Escolher foto'}
            </Button>
            {avatarUrl ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAvatarUrl(null)}>
                Remover
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-ink-faint">A imagem é reduzida no seu aparelho antes de salvar.</p>
        </div>
      </div>

      {photoError ? <ErrorNote message={photoError} /> : null}

      <Field label="Nome">
        {(id) => (
          <TextInput
            id={id}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={MAX_NAME_LENGTH}
          />
        )}
      </Field>

      <Field label="Bio" hint={`${bio.length}/${MAX_BIO_LENGTH}`}>
        {(id, describedBy) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={MAX_BIO_LENGTH}
            placeholder="Em uma linha, o que você está construindo."
          />
        )}
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={save.running}>
          <Icon name="check" className="size-4" />
          Salvar
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={save.running}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
