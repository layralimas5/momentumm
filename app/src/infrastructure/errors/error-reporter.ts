import { errorModuleFor, sanitizeErrorMessage, type ErrorModule } from '@/domain/admin/privacy'
import { isDemoMode } from '@/infrastructure/config/env'
import { supabase } from '@/infrastructure/supabase/client'
import { DomainError } from '@/shared/errors'

/**
 * O relato de erro que a central administrativa recebe.
 *
 * O que sai daqui: código, módulo, mensagem SANITIZADA, ambiente e versão.
 * O que nunca sai: stack com URL contendo token, o estado da tela, o objeto
 * do domínio, o e-mail da pessoa. A sanitização roda aqui e de novo no banco.
 *
 * Erro de domínio (`DomainError`) não é reportado: "essa etapa não existe
 * mais" é regra de negócio funcionando, não falha do produto.
 */

export type Environment = 'producao' | 'preview' | 'desenvolvimento'

export function currentEnvironment(): Environment {
  if (import.meta.env.DEV) return 'desenvolvimento'
  if (typeof window !== 'undefined' && /vercel\.app|netlify\.app|preview/i.test(window.location.hostname)) {
    return 'preview'
  }
  return 'producao'
}

export const APP_VERSION: string = (import.meta.env['VITE_APP_VERSION'] as string | undefined)?.trim() || '0.1.0'

export type ErrorSeverityInput = 'baixa' | 'media' | 'alta' | 'critica'

interface ReportInput {
  readonly code: string
  readonly module?: ErrorModule
  readonly message: string
  readonly severity?: ErrorSeverityInput
}

const recent = new Map<string, number>()
const DEDUPE_MS = 30_000

export function reportError(input: ReportInput): void {
  if (isDemoMode) return
  const code = input.code.toLowerCase().replace(/[^a-z0-9_.-]/g, '_').slice(0, 60) || 'unknown'
  const message = sanitizeErrorMessage(input.message)
  const key = `${code}|${message}`
  const last = recent.get(key) ?? 0
  const now = Date.now()
  if (now - last < DEDUPE_MS) return
  recent.set(key, now)

  void supabase()
    .rpc('report_error', {
      p_code: code,
      p_module: input.module ?? 'app',
      p_message: message,
      p_environment: currentEnvironment(),
      p_app_version: APP_VERSION,
      p_severity: input.severity ?? 'media',
    })
    .then(() => undefined, () => undefined)
}

/** Relata um erro capturado em código, decidindo módulo e severidade pela forma dele. */
export function reportCaughtError(error: unknown, code: string, severity: ErrorSeverityInput = 'media'): void {
  if (error instanceof DomainError) return
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  reportError({ code, module: errorModuleFor(error), message, severity })
}

/** Erros não tratados da janela. Instalado uma vez em `main.tsx`. */
export function installGlobalErrorReporter(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('error', (event) => {
    reportCaughtError(event.error ?? event.message, 'window.error', 'alta')
  })
  window.addEventListener('unhandledrejection', (event) => {
    reportCaughtError(event.reason, 'window.unhandledrejection', 'alta')
  })
}
