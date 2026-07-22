/**
 * Missão diária — um desafio curto e acionável, escolhido de forma
 * determinística por dia (todo mundo vê a mesma missão no mesmo dia).
 * Conteúdo do produto, sem estado: a conclusão é responsabilidade da UI.
 */

const MISSIONS = [
  'Beba 2L de água ao longo do dia.',
  'Escreva 3 coisas pelas quais você é grata.',
  'Faça 15 minutos de movimento — do seu jeito.',
  'Passe 10 minutos sem o celular, só respirando.',
  'Mande uma mensagem carinhosa pra alguém que importa.',
  'Organize um cantinho da casa que te incomoda.',
  'Leia uma página do livro que você começou.',
] as const

/** Índice do dia no ano (1–366) — base determinística da escolha. */
function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000)
}

export function dailyMission(date: Date = new Date()): string {
  return MISSIONS[dayOfYear(date) % MISSIONS.length] ?? MISSIONS[0]
}
