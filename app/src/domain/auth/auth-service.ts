export interface AuthUser {
  readonly id: string
  readonly email: string
}

/**
 * O resultado do cadastro.
 *
 * Conta criada NÃO significa sessão aberta. Com a confirmação de e-mail ligada
 * — que é a configuração sã em produção — o Supabase cria o usuário e devolve
 * `session: null`, esperando o clique no link. Achatar os dois casos num
 * `AuthUser` faz o app achar que logou, tentar entrar e ser devolvido pro
 * formulário sem explicação nenhuma.
 */
export interface SignUpResult {
  readonly user: AuthUser
  /** Verdadeiro quando a conta existe mas ainda não há sessão. */
  readonly needsConfirmation: boolean
}

export interface AuthService {
  currentUser(): Promise<AuthUser | null>
  signIn(email: string, password: string): Promise<AuthUser>
  signUp(email: string, password: string, name: string): Promise<SignUpResult>
  signOut(): Promise<void>
  onChange(listener: (user: AuthUser | null) => void): () => void
}
