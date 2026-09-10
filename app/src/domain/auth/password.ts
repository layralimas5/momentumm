import { DomainError } from '@/shared/errors'

/**
 * A política de senha.
 *
 * ## Por que comprimento, e não "um maiúsculo e um símbolo"
 *
 * A regra de composição é a que todo mundo conhece e a que produz
 * `Senha@123` — previsível pra quem ataca e irritante pra quem usa. O que
 * realmente encarece o ataque é tamanho, e é isso que o NIST recomenda desde
 * 2017: mínimo generoso, nada de troca periódica obrigatória, e bloqueio das
 * senhas que aparecem em vazamento.
 *
 * Doze caracteres porque oito já não custa nada pra quebrar offline, e porque
 * a frase de quatro palavras que uma pessoa lembra passa fácil de doze.
 *
 * ## Isto não substitui a política do servidor
 *
 * O GoTrue tem a própria configuração de senha, e é ela que vale pra quem
 * chama a API direto. Esta validação existe pra o app não empurrar pro
 * servidor uma senha que ele já sabe que vai ser recusada, e pra a mensagem
 * ser em português e dizer o que fazer.
 */

export const MIN_PASSWORD_LENGTH = 12
export const MAX_PASSWORD_LENGTH = 72

/**
 * As mais tentadas em ataque de dicionário, em português e inglês. Uma lista
 * curta e local: a checagem séria contra vazamento é do servidor, que tem a
 * base do HaveIBeenPwned. Aqui só se pega o óbvio antes de sair do navegador.
 */
const OBVIOUS = new Set([
  'senha123456',
  'senhasenha12',
  '123456789012',
  'password1234',
  'qwertyuiop12',
  'momentumm123',
  'abcdefghijkl',
])

export function assertStrongPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new DomainError(
      `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres. Uma frase curta funciona melhor que um código.`,
    )
  }

  /*
    Teto por causa do bcrypt: ele ignora tudo além de 72 bytes, então uma
    senha de 100 caracteres é silenciosamente truncada e a pessoa acredita
    numa proteção que não existe. Melhor recusar do que fingir.
  */
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new DomainError(`A senha pode ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`)
  }

  if (OBVIOUS.has(password.toLowerCase())) {
    throw new DomainError('Essa senha é das mais tentadas em ataques. Escolhe outra.')
  }

  // Um caractere repetido do começo ao fim passa no teste de comprimento e
  // não resiste a nada.
  if (/^(.)\1+$/.test(password)) {
    throw new DomainError('Essa senha é previsível demais. Mistura mais coisa.')
  }
}

/** Força aproximada, só pra tela desenhar a barrinha. Não decide nada. */
export function passwordStrength(password: string): 'fraca' | 'media' | 'forte' {
  if (password.length < MIN_PASSWORD_LENGTH) return 'fraca'

  const variety =
    (/[a-z]/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/\d/.test(password) ? 1 : 0) +
    (/[^\w\s]/.test(password) ? 1 : 0) +
    (/\s/.test(password) ? 1 : 0)

  if (password.length >= 16 || variety >= 3) return 'forte'
  return 'media'
}
