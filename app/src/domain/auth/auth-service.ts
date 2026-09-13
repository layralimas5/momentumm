import type { AdminRole } from '@/domain/admin/admin-role'

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
  readonly user: AuthUser | null
  /** Verdadeiro quando a conta existe mas ainda não há sessão. */
  readonly needsConfirmation: boolean
}

/**
 * Nível de garantia da sessão.
 *
 * `aal1` é senha; `aal2` é senha mais o segundo fator. O valor vem assinado
 * dentro do JWT e é o mesmo que o banco lê em `is_admin()` — não é estado de
 * tela, é o que o servidor acredita sobre a sessão.
 */
export type AssuranceLevel = 'aal1' | 'aal2'

export interface SessionInfo {
  readonly user: AuthUser
  readonly assurance: AssuranceLevel
  /** A conta tem pelo menos um fator verificado registrado. */
  readonly hasMfa: boolean
  /** Papel administrativo E sessão em aal2. As duas coisas, sempre juntas. */
  readonly isAdmin: boolean
  /**
   * O papel da conta, se houver, independente do nível da sessão. Serve só
   * pra MOSTRAR a entrada do painel: quem tem papel vê o link e resolve o
   * segundo fator na porta do `/admin`. Sem papel, o link não existe.
   */
  readonly adminRole: AdminRole | null
}

export interface MfaFactor {
  readonly id: string
  readonly friendlyName: string
  readonly verified: boolean
}

/** O que a tela precisa pra desenhar o QR Code do app autenticador. */
export interface MfaEnrollment {
  readonly factorId: string
  readonly qrCodeSvg: string
  /** Segredo em texto, pra quem digita no lugar de escanear. */
  readonly secret: string
}

/**
 * A porta de autenticação.
 *
 * ## A regra de mensagem que atravessa tudo aqui
 *
 * Nenhuma resposta pode dizer se um e-mail existe na base. Cadastro com
 * e-mail já usado, recuperação de senha de conta inexistente e login errado
 * respondem com a MESMA forma de mensagem que responderiam no caso feliz. É
 * o que impede usar o formulário como oráculo — perguntar "fulano tem conta
 * aqui?" e receber sim ou não, um e-mail por vez.
 *
 * A consequência é uma UX ligeiramente pior de propósito: quem se cadastra
 * duas vezes recebe "confira seu e-mail" nas duas, e descobre pelo conteúdo
 * do e-mail (que só chega pra quem é dono da caixa) o que aconteceu.
 */
export interface AuthService {
  currentUser(): Promise<AuthUser | null>
  /** A sessão inteira: quem, com que garantia, e se pode agir como admin. */
  currentSession(): Promise<SessionInfo | null>

  signIn(email: string, password: string): Promise<AuthUser>
  signUp(email: string, password: string, name: string): Promise<SignUpResult>

  /** Manda pro consentimento do Google. A sessão volta pelo redirect. */
  signInWithGoogle(redirectTo: string): Promise<void>

  /**
   * Dispara o e-mail de recuperação. Resolve sem erro mesmo pra e-mail que
   * não existe: é a regra de não revelar cadastro.
   */
  requestPasswordReset(email: string, redirectTo: string): Promise<void>

  /**
   * Troca a senha da sessão atual. Exige a senha vigente e reautentica antes
   * de gravar — sessão roubada num café não pode virar conta roubada.
   */
  updatePassword(currentPassword: string, newPassword: string): Promise<void>

  /**
   * Grava a senha nova depois do link de recuperação, onde não existe senha
   * atual pra confirmar. Só funciona dentro da sessão de recuperação.
   */
  completePasswordReset(newPassword: string): Promise<void>

  /** Encerra a sessão. `everywhere` derruba também os outros dispositivos. */
  signOut(everywhere?: boolean): Promise<void>

  listMfaFactors(): Promise<readonly MfaFactor[]>
  startMfaEnrollment(): Promise<MfaEnrollment>
  /** Confirma o código do app autenticador e ativa o fator. */
  confirmMfaEnrollment(factorId: string, code: string): Promise<void>
  /** Eleva a sessão pra aal2 usando um fator já registrado. */
  verifyMfa(factorId: string, code: string): Promise<void>
  removeMfaFactor(factorId: string): Promise<void>

  onChange(listener: (user: AuthUser | null) => void): () => void
}
