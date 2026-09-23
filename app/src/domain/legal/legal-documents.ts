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
  privacidade: '2026-09-23',
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

export type LegalVersions = Readonly<Record<LegalDocument, string>>

/**
 * As versões que valem AGORA: a do código, ou a que o owner publicou no
 * painel (`legal.versions`) quando for mais nova. A mais nova ganha porque
 * a data só anda pra frente — um painel apontando pra uma versão anterior
 * ao texto publicado seria um erro de digitação, não uma decisão.
 */
export function effectiveLegalVersions(published: Partial<LegalVersions> | null | undefined): LegalVersions {
  return {
    termos: newest(LEGAL_VERSIONS.termos, published?.termos),
    privacidade: newest(LEGAL_VERSIONS.privacidade, published?.privacidade),
  }
}

function newest(base: string, candidate: string | undefined): string {
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return base
  return candidate > base ? candidate : base
}

/** O que ainda falta aceitar, comparando o registro com as versões vigentes. */
export function pendingLegalDocuments(
  accepted: readonly LegalAcceptance[],
  versions: LegalVersions = LEGAL_VERSIONS,
): readonly LegalDocument[] {
  return LEGAL_DOCUMENTS.filter(
    (document) =>
      !accepted.some((item) => item.document === document && item.version === versions[document]),
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
