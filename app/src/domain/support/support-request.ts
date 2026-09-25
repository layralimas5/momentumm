/**
 * Solicitações: o canal entre a pessoa e a equipe.
 *
 * Categorias, prioridades e estados são os mesmos enums do banco. O texto da
 * solicitação é o único conteúdo pessoal que a equipe lê, e só dentro dela.
 */
export const SUPPORT_CATEGORIES = [
  'suporte',
  'exportacao',
  'exclusao',
  'denuncia',
  'pagamento',
  'acesso',
  'seguranca',
  'privacidade',
] as const
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]

export const SUPPORT_CATEGORY_LABELS: Readonly<Record<SupportCategory, string>> = {
  suporte: 'Ajuda com o app',
  exportacao: 'Exportar meus dados',
  exclusao: 'Excluir minha conta',
  denuncia: 'Denúncia',
  pagamento: 'Pagamento e assinatura',
  acesso: 'Problema de acesso',
  seguranca: 'Relato de segurança',
  privacidade: 'Privacidade',
}

/**
 * As categorias que são DIREITO, e por isso valem em qualquer plano.
 *
 * Exclusão de conta, exportação, privacidade e segurança são obrigação legal;
 * pagamento e acesso são a porta de quem não consegue entrar ou foi cobrado
 * errado — trancar qualquer uma delas atrás do PRO seria pedir assinatura pra
 * pessoa exercer um direito, ou pra ela conseguir reclamar da própria cobrança.
 * Denúncia fica junto pelo mesmo motivo: num produto com camada social, só
 * quem paga poder denunciar é um problema de segurança, não de plano.
 *
 * O que sobra — "Ajuda com o app" — é suporte de PRODUTO, e esse é do PRO.
 */
export const RIGHT_SUPPORT_CATEGORIES: readonly SupportCategory[] = [
  'exportacao',
  'exclusao',
  'denuncia',
  'pagamento',
  'acesso',
  'seguranca',
  'privacidade',
]

/** Categorias que exigem PRO. O servidor recusa (`open_support_request`, 0058). */
export const PRO_SUPPORT_CATEGORIES: readonly SupportCategory[] = SUPPORT_CATEGORIES.filter(
  (category) => !RIGHT_SUPPORT_CATEGORIES.includes(category),
)

export function isProSupportCategory(category: SupportCategory): boolean {
  return PRO_SUPPORT_CATEGORIES.includes(category)
}

/**
 * As categorias que esta conta pode abrir.
 *
 * Uma função só, usada pelos DOIS formulários que existem (a tela de Suporte e
 * o painel do perfil). Duas listas montadas na mão divergiriam no dia em que
 * uma categoria nova entrasse — e a que ficasse pra trás ofereceria um botão
 * que o servidor recusa.
 */
export function supportCategoriesFor(appSupport: boolean): readonly SupportCategory[] {
  return appSupport
    ? SUPPORT_CATEGORIES
    : SUPPORT_CATEGORIES.filter((category) => !isProSupportCategory(category))
}

export const SUPPORT_PRIORITIES = ['baixa', 'normal', 'alta', 'urgente'] as const
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number]

export const SUPPORT_PRIORITY_LABELS: Readonly<Record<SupportPriority, string>> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

export const SUPPORT_STATUSES = [
  'aberta',
  'em_andamento',
  'aguardando_usuario',
  'resolvida',
  'fechada',
] as const
export type SupportStatus = (typeof SUPPORT_STATUSES)[number]

export const SUPPORT_STATUS_LABELS: Readonly<Record<SupportStatus, string>> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  aguardando_usuario: 'Aguardando você',
  resolvida: 'Resolvida',
  fechada: 'Fechada',
}

export const MAX_SUPPORT_SUBJECT = 120
export const MAX_SUPPORT_DESCRIPTION = 2000

/** Os escopos de conteúdo que um acesso excepcional pode cobrir. */
export const CONTENT_SCOPES = [
  'objetivos',
  'acoes',
  'habitos',
  'reviews',
  'registros',
  'midia',
  'ia',
] as const
export type ContentScope = (typeof CONTENT_SCOPES)[number]

export const CONTENT_SCOPE_LABELS: Readonly<Record<ContentScope, string>> = {
  objetivos: 'Títulos e estado dos objetivos',
  acoes: 'Ações dos últimos 30 dias',
  habitos: 'Nomes dos hábitos',
  reviews: 'Os últimos 4 reviews escritos',
  registros: 'Registros dos últimos 30 dias (com nota)',
  midia: 'Lista de arquivos enviados',
  ia: 'Metadados das chamadas à IA (não há conversa guardada)',
}

export const ACCESS_GRANT_STATUSES = ['pendente', 'ativo', 'expirado', 'revogado', 'negado'] as const
export type AccessGrantStatus = (typeof ACCESS_GRANT_STATUSES)[number]

export const ACCESS_GRANT_STATUS_LABELS: Readonly<Record<AccessGrantStatus, string>> = {
  pendente: 'Aguardando seu consentimento',
  ativo: 'Ativo',
  expirado: 'Expirado',
  revogado: 'Revogado por você',
  negado: 'Negado por você',
}

export const MAX_ACCESS_HOURS = 72
export const DEFAULT_ACCESS_HOURS = 24

export const CANCEL_REASONS = [
  'preco',
  'nao_uso',
  'faltam_recursos',
  'problemas_tecnicos',
  'outro_app',
  'temporario',
  'outro',
] as const
export type CancelReason = (typeof CANCEL_REASONS)[number]

export const CANCEL_REASON_LABELS: Readonly<Record<CancelReason, string>> = {
  preco: 'O preço não compensa pra mim',
  nao_uso: 'Não estou usando',
  faltam_recursos: 'Falta algo que eu preciso',
  problemas_tecnicos: 'Problemas técnicos',
  outro_app: 'Vou usar outro app',
  temporario: 'É temporário, volto depois',
  outro: 'Outro motivo',
}

export const MAX_CANCEL_COMMENT = 500
