import type { Profile } from '@/domain/entities/profile'

export interface ProfileUpdate {
  readonly name?: string
  readonly handle?: string
  readonly bio?: string | null
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
