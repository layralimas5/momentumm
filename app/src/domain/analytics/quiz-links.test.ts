import { describe, expect, it } from 'vitest'
import { QUIZ_INTROS, isQuizTheme } from '@/domain/entities/quiz'
import {
  attributionForCode,
  quizLinkFor,
  readQuizChannel,
  QUIZ_LINK_CODES,
  QUIZ_SHORT_PATH,
} from './quiz-links'

const ORIGIN = 'https://www.momentumm.com.br'

describe('códigos de link do quiz', () => {
  it('todo tema declarado existe no quiz', () => {
    for (const [code, entry] of Object.entries(QUIZ_LINK_CODES)) {
      if (entry.theme === null) continue
      expect(isQuizTheme(entry.theme), `${code} aponta pra um tema que não existe`).toBe(true)
      expect(QUIZ_INTROS[entry.theme]).toBeDefined()
    }
  })

  /*
    O código vai na URL de um comentário público: se ele precisar de acento,
    espaço ou maiúscula, o link quebra no caminho até alguém.
  */
  it('todo código é curto e digitável', () => {
    for (const code of Object.keys(QUIZ_LINK_CODES)) {
      expect(code).toMatch(/^[a-z0-9-]{3,12}$/)
    }
  })

  it('a origem sai completa do código', () => {
    expect(attributionForCode('ig-proc')).toEqual({
      source: 'instagram',
      medium: 'comentario',
      campaign: 'procrastinacao',
      content: 'ig-proc',
      theme: 'procrastinacao',
    })
  })

  it('o canal troca só o meio, e o código continua separando os envios', () => {
    const dm = attributionForCode('ig-proc', 'dm')
    expect(dm?.medium).toBe('dm')
    expect(dm?.content).toBe('ig-proc')
    expect(dm?.campaign).toBe('procrastinacao')
  })

  it('maiúscula no caminho não perde a origem', () => {
    expect(attributionForCode('IG-Proc')?.source).toBe('instagram')
  })

  /* Link errado numa campanha não pode virar página de erro: o quiz abre sem origem. */
  it('código desconhecido não tem origem', () => {
    expect(attributionForCode('nao-existe')).toBeNull()
    expect(attributionForCode(null)).toBeNull()
  })

  /*
    Sem `?c=`, a URL não pediu canal nenhum: quem decide passa a ser o código
    (a landing tem o próprio meio) e, na falta dele, o comentário.
  */
  it('o canal só existe quando o link pede, e apelido desconhecido não vale', () => {
    expect(readQuizChannel(new URLSearchParams())).toBeNull()
    expect(readQuizChannel(new URLSearchParams('c=dm'))).toBe('dm')
    expect(readQuizChannel(new URLSearchParams('c=BIO'))).toBe('bio')
    expect(readQuizChannel(new URLSearchParams('c=qualquer'))).toBeNull()
    expect(attributionForCode('ig-proc', readQuizChannel(new URLSearchParams()))?.medium).toBe(
      'comentario',
    )
  })

  /* Os botões da landing não são comentário nem direct: o código diz o meio. */
  it('o código da landing traz o próprio meio', () => {
    expect(attributionForCode('lp-hero')).toEqual({
      source: 'site',
      medium: 'landing',
      campaign: 'hero',
      content: 'lp-hero',
      theme: null,
    })
    expect(attributionForCode('lp-fim')?.campaign).toBe('cta-final')
  })

  it('o canal pedido na URL vence o meio do código', () => {
    expect(attributionForCode('lp-hero', 'dm')?.medium).toBe('dm')
  })

  it('o link do comentário não carrega parâmetro nenhum', () => {
    expect(quizLinkFor(ORIGIN, 'ig-proc')).toBe(`${ORIGIN}${QUIZ_SHORT_PATH}/ig-proc`)
    expect(quizLinkFor(ORIGIN)).toBe(`${ORIGIN}${QUIZ_SHORT_PATH}`)
    expect(quizLinkFor(ORIGIN, 'ig-proc', 'dm')).toBe(`${ORIGIN}${QUIZ_SHORT_PATH}/ig-proc?c=dm`)
  })
})
