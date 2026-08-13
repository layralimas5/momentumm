import { useState } from 'react'
import { ACTIVITY_VISIBILITIES, VISIBILITY_LABELS, type ActivityVisibility } from '@/domain/entities/activity'
import { initialsOf, normalizeHandle, MAX_BIO_LENGTH } from '@/domain/entities/profile'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { Button } from '@/presentation/components/ui/Button'
import { Field, Select, TextInput } from '@/presentation/components/ui/Field'
import { ErrorNote, LoadingBlock } from '@/presentation/components/ui/States'
import { useAsyncAction } from '@/presentation/hooks/use-async-action'

export function ProfilePage() {
  const { user, profile, loading, signOut, refreshProfile } = useAuth()

  const [name, setName] = useState(profile?.name ?? '')
  const [handle, setHandle] = useState(profile?.handle ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [visibility, setVisibility] = useState<ActivityVisibility>(
    profile?.defaultVisibility ?? 'publica',
  )
  const [saved, setSaved] = useState(false)

  const save = useAsyncAction(async () => {
    if (!user) return
    await container.profiles.update(user.id, {
      name,
      handle,
      bio: bio.trim() || null,
      defaultVisibility: visibility,
    })
    await refreshProfile()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  })

  if (loading) return <LoadingBlock label="Carregando teu perfil" />

  if (!profile) {
    return <ErrorNote message="Não consegui carregar teu perfil. Recarrega a página." />
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-dim text-lg font-semibold text-brand-hi"
        >
          {initialsOf(profile.name)}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{profile.name}</h1>
          <p className="truncate text-sm text-ink-muted">@{profile.handle}</p>
        </div>
      </header>

      <form
        className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5"
        onSubmit={(event) => {
          event.preventDefault()
          void save.run()
        }}
      >
        {save.error ? <ErrorNote message={save.error} /> : null}

        <Field label="Nome">
          {(id) => (
            <TextInput
              id={id}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              maxLength={60}
            />
          )}
        </Field>

        <Field label="@" hint="É o teu endereço público no Momentumm.">
          {(id, describedBy) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              value={handle}
              onChange={(event) => setHandle(normalizeHandle(event.target.value))}
              autoComplete="username"
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

        <Field
          label="Visibilidade padrão"
          hint="Vale para os próximos registros. Cada atividade pode ser diferente."
        >
          {(id, describedBy) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as ActivityVisibility)}
            >
              {ACTIVITY_VISIBILITIES.map((item) => (
                <option key={item} value={item}>
                  {VISIBILITY_LABELS[item]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={save.running}>
            Salvar
          </Button>
          <span aria-live="polite" className="text-sm text-positive">
            {saved ? 'Salvo.' : ''}
          </span>
        </div>
      </form>

      <div className="flex items-center justify-between rounded-card border border-line bg-surface p-5">
        <div>
          <p className="text-sm text-ink">Sessão</p>
          <p className="text-sm text-ink-muted">{user?.email}</p>
        </div>
        <Button variant="danger" onClick={() => void signOut()}>
          Sair
        </Button>
      </div>

      {container.demo ? (
        <p className="text-xs text-ink-faint">
          Modo demo: os dados ficam só nesse navegador. Configure o Supabase pra ativar contas reais.
        </p>
      ) : null}
    </div>
  )
}
