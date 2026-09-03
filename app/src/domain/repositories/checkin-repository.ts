import type { CheckIn, NewCheckInInput } from '@/domain/entities/checkin'

export interface CheckInRepository {
  listByUser(userId: string): Promise<CheckIn[]>
  /** Um check-in por dia: registrar de novo substitui o do dia. */
  save(input: NewCheckInInput): Promise<CheckIn>
}
