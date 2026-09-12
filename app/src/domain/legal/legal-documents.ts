/**
 * Versões vigentes dos Termos de Uso e da Política de Privacidade.
 *
 * A versão é a data de publicação, e ela mora AQUI, não no texto da página:
 * é este número que o aceite grava (`legal_acceptances`) e é contra ele que
 * o app decide se precisa pedir o aceite de novo. Mudar o texto sem subir a
 * versão é mudar o combinado sem avisar — então o texto e a data andam
 * juntos, no mesmo commit.
 */
export const LEGAL_DOCUMENTS = ['termos', 'privacidade'] as const
export type LegalDocument = (typeof LEGAL_DOCUMENTS)[number]

export const LEGAL_VERSIONS: Readonly<Record<LegalDocument, string>> = {
  termos: '2026-09-11',
  privacidade: '2026-09-11',
}

export const LEGAL_LABELS: Readonly<Record<LegalDocument, string>> = {
  termos: 'Termos de uso',
  privacidade: 'Política de privacidade',
}

export const LEGAL_PATHS: Readonly<Record<LegalDocument, string>> = {
  termos: '/termos',
  privacidade: '/privacidade',
}

export interface LegalAcceptance {
  readonly document: LegalDocument
  readonly version: string
  readonly acceptedAt: Date
}

/** O que ainda falta aceitar, comparando o registro com as versões vigentes. */
export function pendingLegalDocuments(
  accepted: readonly LegalAcceptance[],
): readonly LegalDocument[] {
  return LEGAL_DOCUMENTS.filter(
    (document) =>
      !accepted.some(
        (item) => item.document === document && item.version === LEGAL_VERSIONS[document],
      ),
  )
}

/** A data de publicação como a página mostra: "11 de setembro de 2026". */
export function formatLegalVersion(version: string): string {
  const [year, month, day] = version.split('-').map(Number)
  if (!year || !month || !day) return version
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
