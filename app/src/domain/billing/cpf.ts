/**
 * CPF: o Asaas exige um válido pra criar o cliente da cobrança Pix, e
 * validar aqui evita a ida ao servidor só pra voltar com "CPF inválido".
 * A regra é a da Receita: dois dígitos verificadores, módulo 11, e as
 * sequências repetidas (000..., 111...) não valem mesmo passando na conta.
 */

export const CPF_LENGTH = 11

/** Só os dígitos, pra aceitar tanto "123.456.789-09" quanto "12345678909". */
export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '')
}

export function isValidCpf(value: string): boolean {
  const digits = normalizeCpf(value)
  if (digits.length !== CPF_LENGTH) return false
  if (/^(\d)\1{10}$/.test(digits)) return false

  const numbers = digits.split('').map(Number)
  return checkDigit(numbers, 9) === numbers[9] && checkDigit(numbers, 10) === numbers[10]
}

function checkDigit(numbers: readonly number[], length: number): number {
  const sum = numbers.slice(0, length).reduce((total, digit, index) => total + digit * (length + 1 - index), 0)
  const remainder = (sum * 10) % 11
  return remainder === 10 ? 0 : remainder
}

/** "12345678909" vira "123.456.789-09" enquanto a pessoa digita. */
export function formatCpf(value: string): string {
  const digits = normalizeCpf(value).slice(0, CPF_LENGTH)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}
