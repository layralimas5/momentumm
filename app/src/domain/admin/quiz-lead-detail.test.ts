import { describe, expect, it } from 'vitest'
import { quizLeadDetailSchema } from './admin-schemas'

/*
  A ficha do contato quebrava com "Algo deu errado" porque o schema exigia
  data em cinco campos que são nulos em toda sessão que não chegou ao fim.
  Quem sai no meio do quiz não tem `completed_at`, e quem sai no meio é a
  maioria dos contatos da lista.
*/
const sessaoNoMeio = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Fulana',
  email: 'fulana@teste.momentumm',
  phone: '11912345678',
  age: 31,
  consent_at: null,
  status: 'iniciado',
  step: 3,
  answers: { goal: 'correr 5km' },
  diagnosis: {},
  theme: null,
  source: { utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null },
  entered_at: '2026-09-20T12:00:00.000Z',
  completed_at: null,
  abandoned_at: null,
  linked_at: null,
  activated_at: null,
  has_account: false,
  user_id: null,
  timeline: [{ name: 'quiz_started', step: 0, at: '2026-09-20T12:00:00.000Z' }],
}

describe('ficha do contato do quiz', () => {
  it('aceita a sessão de quem parou no meio', () => {
    const parsed = quizLeadDetailSchema.safeParse(sessaoNoMeio)
    expect(parsed.success).toBe(true)
  })

  it('converte as datas que existem e mantém nulas as que não existem', () => {
    const lead = quizLeadDetailSchema.parse({
      ...sessaoNoMeio,
      consent_at: '2026-09-20T12:05:00.000Z',
      completed_at: '2026-09-20T12:09:00.000Z',
    })
    expect(lead.consent_at).toBeInstanceOf(Date)
    expect(lead.completed_at).toBeInstanceOf(Date)
    expect(lead.abandoned_at).toBeNull()
    expect(lead.entered_at).toBeInstanceOf(Date)
  })

  it('aceita a sessão que virou conta', () => {
    const lead = quizLeadDetailSchema.parse({
      ...sessaoNoMeio,
      status: 'ativado',
      has_account: true,
      user_id: '22222222-2222-4222-8222-222222222222',
      completed_at: '2026-09-20T12:09:00.000Z',
      linked_at: '2026-09-20T12:10:00.000Z',
      activated_at: '2026-09-20T12:11:00.000Z',
    })
    expect(lead.has_account).toBe(true)
    expect(lead.activated_at).toBeInstanceOf(Date)
  })
})
