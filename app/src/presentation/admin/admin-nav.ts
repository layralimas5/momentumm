import type { AdminCapability } from '@/domain/admin/admin-role'
import type { IconName } from '@/presentation/components/ui/Icon'

export interface AdminNavItem {
  readonly to: string
  readonly label: string
  readonly icon: IconName
  readonly end: boolean
  /** Sem a capacidade o item não aparece. O banco recusa de qualquer jeito. */
  readonly requires: AdminCapability
  /** Tela só de consulta: é o que o celular prioriza. */
  readonly readOnly: boolean
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { to: '/admin', label: 'Visão geral', icon: 'hoje', end: true, requires: 'metrics.read', readOnly: true },
  { to: '/admin/usuarios', label: 'Usuários', icon: 'jornada', end: false, requires: 'users.read', readOnly: false },
  { to: '/admin/assinaturas', label: 'Assinaturas', icon: 'metas', end: false, requires: 'subscriptions.read', readOnly: true },
  { to: '/admin/cancelamentos', label: 'Cancelamentos', icon: 'adiar', end: false, requires: 'metrics.read', readOnly: true },
  { to: '/admin/ia', label: 'Momentumm AI', icon: 'ia', end: false, requires: 'metrics.read', readOnly: true },
  { to: '/admin/retencao', label: 'Retenção', icon: 'progresso', end: false, requires: 'metrics.read', readOnly: true },
  { to: '/admin/recursos', label: 'Recursos', icon: 'insights', end: false, requires: 'metrics.read', readOnly: true },
  { to: '/admin/funil', label: 'Funil do quiz', icon: 'play', end: false, requires: 'metrics.read', readOnly: true },
  { to: '/admin/erros', label: 'Erros e saúde', icon: 'raio', end: false, requires: 'errors.read', readOnly: true },
  { to: '/admin/solicitacoes', label: 'Solicitações', icon: 'sino', end: false, requires: 'requests.read', readOnly: false },
  { to: '/admin/auditoria', label: 'Auditoria', icon: 'arquivar', end: false, requires: 'audit.read', readOnly: true },
  { to: '/admin/configuracoes', label: 'Configurações', icon: 'config', end: false, requires: 'settings.read', readOnly: false },
  { to: '/admin/painel', label: 'Painel', icon: 'cadeado', end: false, requires: 'admins.read', readOnly: false },
]

export function adminNavItemFor(pathname: string): AdminNavItem | undefined {
  return ADMIN_NAV.filter((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
    .sort((a, b) => b.to.length - a.to.length)[0]
}
