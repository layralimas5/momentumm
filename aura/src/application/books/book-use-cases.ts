import type { BookRepository } from '@/domain/repositories/book-repository'
import { BookRules, type Book, type NewBook, type ReadingStatus } from '@/domain/entities/book'

/**
 * Casos de uso de Livros/Leituras. Regras de domínio + repositório,
 * independentes de UI e infraestrutura.
 */
export function createBookUseCases(repo: BookRepository) {
  return {
    list(userId: string): Promise<Book[]> {
      return repo.listByUser(userId)
    },

    async create(userId: string, data: NewBook): Promise<Book> {
      if (!BookRules.isValidTitle(data.title)) {
        throw new Error('O título do livro precisa ter entre 1 e 200 caracteres.')
      }
      return repo.create(userId, data)
    },

    setStatus(id: string, status: ReadingStatus): Promise<Book> {
      return repo.updateStatus(id, status)
    },

    remove(id: string): Promise<void> {
      return repo.remove(id)
    },
  }
}

export type BookUseCases = ReturnType<typeof createBookUseCases>
