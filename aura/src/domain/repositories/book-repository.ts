import type { Book, NewBook, ReadingStatus } from '@/domain/entities/book'

/**
 * Port do repositório de Livros/Leituras. A aplicação depende dessa interface.
 * A implementação concreta vive na camada de infraestrutura.
 */
export interface BookRepository {
  listByUser(userId: string): Promise<Book[]>
  create(userId: string, data: NewBook): Promise<Book>
  updateStatus(id: string, status: ReadingStatus): Promise<Book>
  remove(id: string): Promise<void>
}
