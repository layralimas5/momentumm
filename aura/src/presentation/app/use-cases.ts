import { container } from '@/infrastructure/container'
import { createGoalUseCases } from '@/application/goals/goal-use-cases'
import { createBookUseCases } from '@/application/books/book-use-cases'
import { createProfileUseCases } from '@/application/profiles/profile-use-cases'

/**
 * Instâncias prontas dos casos de uso, montadas a partir do container.
 * A camada de apresentação importa daqui — não conhece a infraestrutura.
 */
export const goalUseCases = createGoalUseCases(container.goals)
export const bookUseCases = createBookUseCases(container.books)
export const profileUseCases = createProfileUseCases(container.profiles)
export const usingDemoData = container.usingDemoData
