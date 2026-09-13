import type { LegalAcceptance, LegalDocument, LegalVersions } from '@/domain/legal/legal-documents'
import { LEGAL_VERSIONS } from '@/domain/legal/legal-documents'
import type { LegalAcceptanceRepository } from '@/domain/repositories/legal-acceptance-repository'
import { InfrastructureError } from '@/shared/errors'
import { supabase } from './client'

/** `legal_acceptances`: só o dono lê e grava; ninguém edita nem apaga (migration 0020). */
export class SupabaseLegalAcceptanceRepository implements LegalAcceptanceRepository {
  async listMine(userId: string): Promise<LegalAcceptance[]> {
    const { data, error } = await supabase()
      .from('legal_acceptances')
      .select('document, version, accepted_at')
      .eq('user_id', userId)
    if (error) throw new InfrastructureError('Não consegui ler os aceites.', error)
    return (data ?? []).map((row) => ({
      document: row.document as LegalDocument,
      version: String(row.version),
      acceptedAt: new Date(String(row.accepted_at)),
    }))
  }

  async accept(userId: string, documents: readonly LegalDocument[], versions: LegalVersions = LEGAL_VERSIONS): Promise<void> {
    if (documents.length === 0) return
    const { error } = await supabase()
      .from('legal_acceptances')
      .upsert(
        documents.map((document) => ({
          user_id: userId,
          document,
          version: versions[document],
        })),
        { onConflict: 'user_id,document,version', ignoreDuplicates: true },
      )
    if (error) throw new InfrastructureError('Não consegui registrar o aceite.', error)
  }
}
