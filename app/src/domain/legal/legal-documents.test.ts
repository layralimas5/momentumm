import { describe, expect, it } from 'vitest'
import { formatLegalVersion, LEGAL_VERSIONS, pendingLegalDocuments } from './legal-documents'

describe('pendingLegalDocuments', () => {
  it('sem aceite, os dois documentos estão pendentes', () => {
    expect(pendingLegalDocuments([])).toEqual(['termos', 'privacidade'])
  })

  it('aceite de versão antiga continua pendente; da vigente, não', () => {
    const old = { document: 'termos' as const, version: '2020-01-01', acceptedAt: new Date() }
    expect(pendingLegalDocuments([old])).toEqual(['termos', 'privacidade'])

    const current = [
      { document: 'termos' as const, version: LEGAL_VERSIONS.termos, acceptedAt: new Date() },
      { document: 'privacidade' as const, version: LEGAL_VERSIONS.privacidade, acceptedAt: new Date() },
    ]
    expect(pendingLegalDocuments(current)).toEqual([])
  })

  it('as versões vigentes são datas, como a tabela exige', () => {
    for (const version of Object.values(LEGAL_VERSIONS)) {
      expect(version).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    expect(formatLegalVersion('2026-09-11')).toContain('2026')
  })
})
