import type { Profile } from '@/domain/entities/profile'

export interface ProfileUpdate {
  readonly name?: string
  readonly handle?: string
  readonly bio?: string | null
  /**
   * A foto do perfil, já como data URL reduzida.
   *
   * Guardar a imagem na própria coluna evita um bucket de Storage inteiro —
   * políticas, URL assinada e limpeza de órfão — pra um arquivo de ~20KB que
   * cada conta tem UM. Quando existir foto de capa, álbum ou qualquer coisa que
   * multiplique isso, a migração pro Storage é trocar o conteúdo desta coluna
   * por um caminho, e nada acima daqui muda.
   */
  readonly avatarUrl?: string | null
  readonly defaultVisibility?: Profile['defaultVisibility']
  /**
   * Só o modo demo aplica. Em produção quem manda no plano é a assinatura, não
   * a tela de perfil — o repositório do Supabase ignora esse campo de propósito.
   */
  readonly plan?: Profile['plan']
}

export interface ProfileRepository {
  findById(id: string): Promise<Profile | null>
  update(id: string, changes: ProfileUpdate): Promise<Profile>
}
