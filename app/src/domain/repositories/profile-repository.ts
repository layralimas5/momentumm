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
  /** Quem vê o perfil: privado, somente amigos ou público. */
  readonly visibility?: Profile['visibility']
  /** Dias da semana de descanso planejado (0 = domingo). Saem da conta do Momentum. */
  readonly restWeekdays?: readonly number[]
  /**
   * Só o modo demo aplica. Em produção quem manda no plano é a assinatura, não
   * a tela de perfil — o repositório do Supabase ignora esse campo de propósito.
   */
  readonly plan?: Profile['plan']
}

export interface ProfileRepository {
  findById(id: string): Promise<Profile | null>
  update(id: string, changes: ProfileUpdate): Promise<Profile>
  /**
   * Apaga a conta e tudo que depende dela.
   *
   * Sem parâmetro de propósito: quem é apagado é sempre a sessão atual. Um
   * `deleteAccount(id)` seria uma assinatura que convida a passar o id de
   * outra pessoa, e a checagem passaria a depender de quem chama.
   */
  deleteAccount(): Promise<void>
  /**
   * Apaga o conteúdo e mantém a conta: login, plano, papéis e amizades ficam.
   * É o "recomeçar do zero"; `deleteAccount` é o "ir embora".
   */
  resetData(): Promise<void>
  /**
   * Tudo que a conta registrou, num JSON só (`momentumm.export.v1`). É o
   * direito de portabilidade: a pessoa leva o que é dela, e só o que é dela —
   * o dado do amigo que ela enxerga pelo Círculo não entra.
   */
  exportData(): Promise<AccountExport>
}

export interface AccountExport {
  readonly exported_at: string
  readonly format: 'momentumm.export.v1'
  readonly [section: string]: unknown
}
