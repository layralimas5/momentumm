import type { Profile } from '@/domain/entities/profile'

export interface ProfileUpdate {
  readonly name?: string
  readonly handle?: string
  readonly bio?: string | null
  readonly defaultVisibility?: Profile['defaultVisibility']
}

export interface ProfileRepository {
  findById(id: string): Promise<Profile | null>
  update(id: string, changes: ProfileUpdate): Promise<Profile>
}
