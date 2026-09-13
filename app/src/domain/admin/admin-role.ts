/**
 * Os papéis do painel administrativo e o que cada um pode fazer.
 *
 * A matriz vale pra DESENHAR a tela: esconder o botão que o papel não tem,
 * não listar a rota que ele não abre. A regra que vale de verdade mora no
 * banco (`assert_admin_role` em cada função) e na Edge Function — o front
 * nunca é a barreira, só a cortesia de não mostrar o que vai ser recusado.
 */
export const ADMIN_ROLES = ['owner', 'admin', 'support', 'analyst'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export const ADMIN_ROLE_LABELS: Readonly<Record<AdminRole, string>> = {
  owner: 'Owner',
  admin: 'Admin',
  support: 'Suporte',
  analyst: 'Analista',
}

export const ADMIN_ROLE_HINTS: Readonly<Record<AdminRole, string>> = {
  owner: 'Configurações gerais e gestão de administradores.',
  admin: 'Operação: usuários, assinaturas e produto.',
  support: 'Solicitações e os dados básicos que elas exigem.',
  analyst: 'Só métricas agregadas, sem dado pessoal.',
}

export const ADMIN_CAPABILITIES = [
  'metrics.read',
  'users.read',
  'users.act',
  'users.logs',
  'subscriptions.read',
  'cancellations.comment',
  'requests.read',
  'requests.act',
  'content_access.request',
  'errors.read',
  'errors.act',
  'ai.block',
  'settings.read',
  'settings.write',
  'audit.read',
  'admins.read',
  'admins.write',
] as const
export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number]

const ROLE_CAPABILITIES: Readonly<Record<AdminRole, ReadonlySet<AdminCapability>>> = {
  owner: new Set(ADMIN_CAPABILITIES),
  admin: new Set<AdminCapability>([
    'metrics.read',
    'users.read',
    'users.act',
    'users.logs',
    'subscriptions.read',
    'cancellations.comment',
    'requests.read',
    'requests.act',
    'content_access.request',
    'errors.read',
    'errors.act',
    'ai.block',
    'settings.read',
    'audit.read',
    'admins.read',
  ]),
  support: new Set<AdminCapability>([
    'metrics.read',
    'users.read',
    'subscriptions.read',
    'requests.read',
    'requests.act',
    'content_access.request',
    'errors.read',
  ]),
  analyst: new Set<AdminCapability>(['metrics.read', 'errors.read']),
}

export function can(role: AdminRole | null, capability: AdminCapability): boolean {
  if (!role) return false
  return ROLE_CAPABILITIES[role].has(capability)
}

/** A sessão administrativa vence uma hora depois da última verificação do fator. */
export const ADMIN_SESSION_MINUTES = 60
/** Ação crítica exige fator verificado nos últimos cinco minutos. */
export const ADMIN_STEP_UP_MINUTES = 5

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value)
}
