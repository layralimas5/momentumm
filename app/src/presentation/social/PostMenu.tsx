import { useState } from 'react'
import {
  POST_VISIBILITY_LABELS,
  type Post,
  type PostVisibility,
} from '@/domain/entities/post'
import { container } from '@/infrastructure/container'
import { useAuth } from '@/presentation/auth/use-auth'
import { BottomSheet, SheetAction } from '@/presentation/components/ui/BottomSheet'
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog'
import { Icon } from '@/presentation/components/ui/Icon'
import { toUserMessage } from '@/shared/errors'
import { useSocialNotify } from './PostComposerProvider'
import { ReportSheet } from './ReportSheet'

/**
 * O menu "..." de uma publicação.
 *
 * Ele oferece coisas DIFERENTES pro autor e pra quem vê, e é por isso que ele
 * é um componente e não uma lista fixa: um menu que mostra "Apagar" desabilitado
 * pra quem não pode apagar é um menu que ensina a pessoa a tentar.
 *
 *   autor      trocar quem vê, apagar
 *   visitante  denunciar, bloquear a pessoa
 *
 * "Não quero ver isto" não existe: ele é a porta de um algoritmo de
 * recomendação, e o feed daqui é cronológico de propósito. Quem não quer ver
 * alguém deixa de seguir ou bloqueia, e as duas coisas são explícitas.
 */
export function PostMenu({
  post,
  onChanged,
  onRemoved,
}: {
  readonly post: Post
  readonly onChanged: (post: Post) => void
  readonly onRemoved: () => void
}) {
  const { profile } = useAuth()
  const { notify, warn } = useSocialNotify()
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [blocking, setBlocking] = useState(false)

  const mine = profile?.id === post.author.id

  /*
    O diálogo fecha no toque e o resultado chega pelo aviso de baixo.

    É o contrato do `ConfirmDialog` do app, e ele está certo pro caso comum:
    segurar o diálogo aberto com um spinner por causa de uma rede lenta é o
    que faz a pessoa tocar de novo. O que não pode é a falha ser muda, e por
    isso o `catch` avisa em vez de engolir.
  */
  const remove = async () => {
    try {
      await container.social.removePost(post.id)
      setOpen(false)
      onRemoved()
      notify('Publicação apagada.')
    } catch (cause) {
      warn(toUserMessage(cause))
    }
  }

  const changeVisibility = async (next: PostVisibility) => {
    try {
      await container.social.setPostVisibility(post.id, next)
      onChanged({ ...post, visibility: next })
      setOpen(false)
      notify(next === 'privada' ? 'Agora só você vê.' : 'Publicada de volta.')
    } catch (cause) {
      warn(toUserMessage(cause))
    }
  }

  const block = async () => {
    try {
      await container.social.block(post.author.id)
      setOpen(false)
      onRemoved()
      notify(`${post.author.name} foi bloqueada.`)
    } catch (cause) {
      warn(toUserMessage(cause))
    }
  }

  const otherVisibility: PostVisibility = post.visibility === 'privada' ? 'seguidores' : 'privada'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="grid size-11 shrink-0 place-items-center rounded-full text-ink-faint transition-colors active:bg-surface-hi"
      >
        <Icon name="maisOpcoes" className="size-5" strokeWidth={2.5} />
        <span className="sr-only">Opções da publicação</span>
      </button>

      <BottomSheet
        open={open && !confirmDelete && !reporting && !blocking}
        title="Publicação"
        onClose={() => setOpen(false)}
      >
        <div className="flex flex-col gap-1">
          {mine ? (
            <>
              <SheetAction
                icon={<Icon name={otherVisibility === 'privada' ? 'cadeado' : 'pessoas'} className="size-5" />}
                label={`Mudar para "${POST_VISIBILITY_LABELS[otherVisibility]}"`}
                hint={
                  otherVisibility === 'privada'
                    ? 'Some do feed de todo mundo, continua no teu calendário'
                    : 'Volta a aparecer pra quem te acompanha'
                }
                onClick={() => void changeVisibility(otherVisibility)}
              />
              <SheetAction
                icon={<Icon name="lixeira" className="size-5" />}
                label="Apagar publicação"
                hint="Some do feed, do perfil e do calendário"
                tone="danger"
                onClick={() => setConfirmDelete(true)}
              />
            </>
          ) : (
            <>
              <SheetAction
                icon={<Icon name="bandeira" className="size-5" />}
                label="Denunciar"
                hint="A gente revisa. Ninguém fica sabendo que foi você"
                onClick={() => setReporting(true)}
              />
              <SheetAction
                icon={<Icon name="bloquear" className="size-5" />}
                label={`Bloquear ${post.author.name}`}
                hint="Vocês param de se ver por aqui"
                tone="danger"
                onClick={() => setBlocking(true)}
              />
            </>
          )}
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={confirmDelete}
        title="Apagar esta publicação?"
        description="A foto, a legenda, as curtidas e os comentários somem junto. O dia continua no teu calendário, só sem imagem."
        confirmLabel="Apagar"
        destructive
        onConfirm={() => void remove()}
        onClose={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={blocking}
        title={`Bloquear ${post.author.name}?`}
        description="Vocês param de ver o conteúdo um do outro, e quem seguia quem deixa de seguir. Dá pra desfazer nas configurações."
        confirmLabel="Bloquear"
        destructive
        onConfirm={() => void block()}
        onClose={() => setBlocking(false)}
      />

      <ReportSheet
        open={reporting}
        targetKind="publicacao"
        targetId={post.id}
        onClose={() => setReporting(false)}
        onSent={() => {
          setReporting(false)
          setOpen(false)
          notify('Denúncia enviada. Obrigada por avisar.')
        }}
      />
    </>
  )
}
