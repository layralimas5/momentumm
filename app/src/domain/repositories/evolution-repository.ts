import type { EvolutionSnapshot } from '@/domain/entities/evolution'

/**
 * Só leitura, de propósito. O XP é concedido pelo servidor em reação ao que a
 * pessoa faz (ação, hábito, etapa, objetivo, review); não existe "dar XP" como
 * operação do app. Um método de escrita aqui seria a porta que o servidor
 * fechou.
 */
export interface EvolutionRepository {
  load(userId: string): Promise<EvolutionSnapshot>
}
