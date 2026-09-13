import type { LegalAcceptance, LegalDocument, LegalVersions } from '@/domain/legal/legal-documents'

/**
 * O registro de aceite. Só lê os próprios e grava os próprios; não existe
 * editar nem apagar, porque aceite é fato datado, não preferência.
 */
export interface LegalAcceptanceRepository {
  listMine(userId: string): Promise<LegalAcceptance[]>
  /** Grava o aceite com a versão vigente de cada documento. */
  accept(userId: string, documents: readonly LegalDocument[], versions?: LegalVersions): Promise<void>
}
