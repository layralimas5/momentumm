import type { LegalAcceptance, LegalDocument } from '@/domain/legal/legal-documents'

/**
 * O registro de aceite. Só lê os próprios e grava os próprios; não existe
 * editar nem apagar, porque aceite é fato datado, não preferência.
 */
export interface LegalAcceptanceRepository {
  listMine(userId: string): Promise<LegalAcceptance[]>
  accept(userId: string, documents: readonly LegalDocument[]): Promise<void>
}
