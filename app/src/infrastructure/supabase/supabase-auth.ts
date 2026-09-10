import type {
  AssuranceLevel,
  AuthService,
  AuthUser,
  MfaEnrollment,
  MfaFactor,
  SessionInfo,
  SignUpResult,
} from '@/domain/auth/auth-service'
import { assertStrongPassword } from '@/domain/auth/password'
import { assertValidName } from '@/domain/entities/profile'
import { DomainError } from '@/shared/errors'
import { supabase } from './client'

/**
 * Autenticação no Supabase.
 *
 * Saiu de `supabase-repositories` porque deixou de ser um adaptador de quatro
 * métodos: MFA, recuperação, OAuth e nível de garantia da sessão são regras
 * de segurança, e elas merecem um arquivo que dê pra ler inteiro numa
 * revisão.
 *
 * ## A regra que atravessa o arquivo
 *
 * Nenhuma resposta revela se um e-mail tem conta. Senha errada, e-mail
 * inexistente, cadastro repetido e recuperação de conta que não existe saem
 * todos com a mesma forma de mensagem. É o que impede usar o formulário como
 * oráculo de "fulano usa esse app?".
 */

/** O que o GoTrue responde quando o limite de tentativas estoura. */
function isRateLimited(error: { status?: number | undefined; message?: string } | null): boolean {
  if (!error) return false
  return error.status === 429 || /rate limit|too many/i.test(error.message ?? '')
}

/**
 * A única condição de erro de auth que vale contar em detalhe: ela é
 * acionável ("espera") e não diz nada sobre existir ou não uma conta.
 */
const RATE_LIMIT_MESSAGE = 'Muitas tentativas seguidas. Espera alguns minutos e tenta de novo.'

export class SupabaseAuthService implements AuthService {
  async currentUser(): Promise<AuthUser | null> {
    const { data, error } = await supabase().auth.getUser()
    if (error || !data.user?.email) return null
    return { id: data.user.id, email: data.user.email }
  }

  /**
   * A sessão como o SERVIDOR a enxerga.
   *
   * `aal` vem de `getAuthenticatorAssuranceLevel`, que reflete o JWT — o
   * mesmo valor que o Postgres lê em `is_admin()`. Assim a tela e o banco
   * nunca discordam sobre a sessão estar em dois fatores, e não existe um
   * "sou admin" guardado em estado de cliente.
   */
  async currentSession(): Promise<SessionInfo | null> {
    const { data, error } = await supabase().auth.getUser()
    if (error || !data.user?.email) return null

    const user: AuthUser = { id: data.user.id, email: data.user.email }

    const { data: level } = await supabase().auth.mfa.getAuthenticatorAssuranceLevel()
    const assurance: AssuranceLevel = level?.currentLevel === 'aal2' ? 'aal2' : 'aal1'

    const factors = await this.listMfaFactors()

    /*
      O papel é lido de `user_roles`, nunca de `user_metadata`.

      Metadata é escrito pelo próprio cliente em `updateUser`: um papel
      guardado ali seria auto-atribuível com uma linha de console.
      `user_roles` não tem política de escrita pra API pública.
    */
    const { data: adminRow } = await supabase()
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    return {
      user,
      assurance,
      hasMfa: factors.some((factor) => factor.verified),
      // As duas condições juntas, igual ao `is_admin()` do banco. Papel sem
      // segundo fator não é sessão administrativa.
      isAdmin: adminRow !== null && assurance === 'aal2',
    }
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await supabase().auth.signInWithPassword({ email, password })

    if (isRateLimited(error)) throw new DomainError(RATE_LIMIT_MESSAGE)
    if (error || !data.user?.email) {
      // Uma frase só pros dois casos: senha errada e e-mail sem conta.
      throw new DomainError('E-mail ou senha não conferem.')
    }
    return { id: data.user.id, email: data.user.email }
  }

  /**
   * Cadastro que não confirma nem desmente a existência da conta.
   *
   * Antes o `error.message` do GoTrue subia direto pra tela, e ele diz "User
   * already registered" com todas as letras: o formulário virava um
   * verificador de e-mails.
   *
   * Agora todo caminho não-fatal termina igual — sem usuário e pedindo
   * confirmação. Quem já tinha conta recebe do Supabase um e-mail avisando
   * disso; quem não tinha recebe o link. A informação chega pela caixa de
   * entrada, que só o dono abre.
   */
  async signUp(email: string, password: string, name: string): Promise<SignUpResult> {
    assertValidName(name)
    assertStrongPassword(password)

    const { data, error } = await supabase().auth.signUp({
      email,
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: `${window.location.origin}/entrar`,
      },
    })

    if (isRateLimited(error)) throw new DomainError(RATE_LIMIT_MESSAGE)

    // Erro de política de senha é seguro e acionável: ele fala da senha
    // digitada agora, não da base de usuários.
    if (error && /password|senha/i.test(error.message)) {
      throw new DomainError('Essa senha não atende aos requisitos mínimos.')
    }

    if (error || !data.user) return { user: null, needsConfirmation: true }

    if (data.session && data.user.email) {
      return { user: { id: data.user.id, email: data.user.email }, needsConfirmation: false }
    }

    return { user: null, needsConfirmation: true }
  }

  async signInWithGoogle(redirectTo: string): Promise<void> {
    const { error } = await supabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) throw new DomainError('Não consegui abrir o login do Google agora.')
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), { redirectTo })

    /*
      Só o limite de tentativas sobe pra tela. Qualquer outro erro é engolido
      de propósito: "e-mail não encontrado" aqui é a mesma enumeração do
      cadastro, com a vantagem, pra quem ataca, de nem precisar de senha.
    */
    if (isRateLimited(error)) throw new DomainError(RATE_LIMIT_MESSAGE)
  }

  /**
   * Trocar a senha exige provar a senha atual.
   *
   * `updateUser({ password })` sozinho aceita qualquer sessão válida — quem
   * pega o navegador destravado troca a senha e fica com a conta. A
   * reautenticação é o que separa "tem a sessão" de "é a pessoa".
   */
  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    assertStrongPassword(newPassword)

    const { data: current } = await supabase().auth.getUser()
    const email = current.user?.email
    if (!email) throw new DomainError('Sessão expirada. Entra de novo pra trocar a senha.')

    const { error: reauth } = await supabase().auth.signInWithPassword({
      email,
      password: currentPassword,
    })
    if (reauth) throw new DomainError('A senha atual não confere.')

    const { error } = await supabase().auth.updateUser({ password: newPassword })
    if (error) throw new DomainError('Não consegui trocar a senha agora.')

    await this.revokeOtherSessions()
  }

  async completePasswordReset(newPassword: string): Promise<void> {
    assertStrongPassword(newPassword)

    const { data } = await supabase().auth.getUser()
    if (!data.user) {
      throw new DomainError('Esse link não vale mais. Pede a recuperação de novo.')
    }

    const { error } = await supabase().auth.updateUser({ password: newPassword })
    if (error) throw new DomainError('Não consegui salvar a senha nova.')

    await this.revokeOtherSessions()
  }

  async signOut(everywhere = false): Promise<void> {
    await supabase().auth.signOut({ scope: everywhere ? 'global' : 'local' })
  }

  async listMfaFactors(): Promise<readonly MfaFactor[]> {
    const { data, error } = await supabase().auth.mfa.listFactors()
    if (error || !data) return []

    return (data.all ?? []).map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name ?? 'App autenticador',
      verified: factor.status === 'verified',
    }))
  }

  async startMfaEnrollment(): Promise<MfaEnrollment> {
    const { data, error } = await supabase().auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Momentumm ${new Date().toISOString().slice(0, 10)}`,
    })

    if (error || !data) throw new DomainError('Não consegui iniciar a verificação em duas etapas.')

    return { factorId: data.id, qrCodeSvg: data.totp.qr_code, secret: data.totp.secret }
  }

  async confirmMfaEnrollment(factorId: string, code: string): Promise<void> {
    await this.challengeAndVerify(factorId, code, 'Código inválido. Confere o app e tenta de novo.')
  }

  async verifyMfa(factorId: string, code: string): Promise<void> {
    await this.challengeAndVerify(factorId, code, 'Código inválido ou expirado.')
  }

  async removeMfaFactor(factorId: string): Promise<void> {
    const { error } = await supabase().auth.mfa.unenroll({ factorId })
    if (error) throw new DomainError('Não consegui remover esse fator agora.')
  }

  onChange(listener: (user: AuthUser | null) => void): () => void {
    const { data } = supabase().auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      listener(user?.email ? { id: user.id, email: user.email } : null)
    })
    return () => data.subscription.unsubscribe()
  }

  /**
   * Senha nova derruba as OUTRAS sessões, nunca a atual.
   *
   * Quem troca a senha normalmente está reagindo a uma suspeita, e manter
   * viva a sessão de quem entrou indevidamente esvazia a troca. Derrubar
   * também a sessão atual faria a pessoa achar que a operação falhou.
   */
  private async revokeOtherSessions(): Promise<void> {
    await supabase().auth.signOut({ scope: 'others' })
  }

  /**
   * Desafio e verificação numa chamada só.
   *
   * São dois passos no GoTrue e nenhuma tela precisa deles separados —
   * separar aqui só criaria a chance de verificar contra um desafio velho.
   */
  private async challengeAndVerify(
    factorId: string,
    code: string,
    failureMessage: string,
  ): Promise<void> {
    const digits = code.replace(/\D/g, '')
    if (digits.length !== 6) throw new DomainError('O código tem seis dígitos.')

    const { data: challenge, error: challengeError } = await supabase().auth.mfa.challenge({
      factorId,
    })
    if (challengeError || !challenge) throw new DomainError(failureMessage)

    const { error } = await supabase().auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: digits,
    })
    if (error) throw new DomainError(failureMessage)
  }
}
