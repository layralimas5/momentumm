export interface AuthUser {
  readonly id: string
  readonly email: string
}

export interface AuthService {
  currentUser(): Promise<AuthUser | null>
  signIn(email: string, password: string): Promise<AuthUser>
  signUp(email: string, password: string, name: string): Promise<AuthUser>
  signOut(): Promise<void>
  onChange(listener: (user: AuthUser | null) => void): () => void
}
